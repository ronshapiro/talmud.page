import {DEFAULT_RSI_SIGNALS, setupRsiSignalHandler} from "./signal_handler";
import * as agentRunner from "./agent_runner";

describe("RsiSignalHandler", () => {
  let logs: string[];
  let errors: string[];
  let exitCalls: number[];
  let mockLogger: {log: (msg: string) => void; error: (msg: string) => void};
  let mockExit: (code: number) => void;

  beforeEach(() => {
    logs = [];
    errors = [];
    exitCalls = [];
    mockLogger = {
      log: (msg: string) => logs.push(msg),
      error: (msg: string) => errors.push(msg),
    };
    mockExit = (code: number) => {
      exitCalls.push(code);
    };
  });

  test("registers listeners for default signals and uninstalls cleanly", () => {
    const processOnSpy = jest.spyOn(process, "on");
    const processRemoveListenerSpy = jest.spyOn(process, "removeListener");

    const handler = setupRsiSignalHandler({
      onCreatePr: async () => {},
      logger: mockLogger,
      exit: mockExit,
    });

    for (const sig of DEFAULT_RSI_SIGNALS) {
      expect(processOnSpy).toHaveBeenCalledWith(sig, expect.any(Function));
    }

    handler.uninstall();

    for (const sig of DEFAULT_RSI_SIGNALS) {
      expect(processRemoveListenerSpy).toHaveBeenCalledWith(sig, expect.any(Function));
    }

    processOnSpy.mockRestore();
    processRemoveListenerSpy.mockRestore();
  });

  test("intercepts signal, stops active agents, creates PR, and exits with 0", async () => {
    const onStopAgents = jest.fn(async () => {});
    const onCreatePr = jest.fn(async () => {});

    const handler = setupRsiSignalHandler({
      onStopAgents,
      onCreatePr,
      logger: mockLogger,
      exit: mockExit,
    });

    expect(handler.isShuttingDown()).toBe(false);

    await handler.handleSignal("SIGINT");

    expect(handler.isShuttingDown()).toBe(true);
    expect(onStopAgents).toHaveBeenCalledTimes(1);
    expect(onCreatePr).toHaveBeenCalledTimes(1);
    expect(exitCalls).toEqual([0]);
    expect(logs.some(l => l.includes("Received SIGINT"))).toBe(true);
    expect(logs.some(l => l.includes("Creating PR"))).toBe(true);
    expect(logs.some(l => l.includes("Process finished cleanly"))).toBe(true);

    handler.uninstall();
  });

  test("forces exit 130 if a second signal arrives while shutting down", async () => {
    const onStopAgents = jest.fn(async () => {});
    const onCreatePr = jest.fn(async () => {
      // Simulate slow PR creation
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    const handler = setupRsiSignalHandler({
      onStopAgents,
      onCreatePr,
      logger: mockLogger,
      exit: mockExit,
    });

    const firstPromise = handler.handleSignal("SIGTERM");
    // Second signal arrives before first finishes
    await handler.handleSignal("SIGINT");

    expect(exitCalls).toContain(130);
    expect(logs.some(l => l.includes("Received second SIGINT. Forcing immediate exit"))).toBe(true);

    await firstPromise;
    handler.uninstall();
  });

  test("falls back to stopAllActiveAgents if onStopAgents is omitted", async () => {
    const stopAllSpy = jest.spyOn(agentRunner, "stopAllActiveAgents").mockReturnValue(2);
    const onCreatePr = jest.fn(async () => {});

    const handler = setupRsiSignalHandler({
      onCreatePr,
      logger: mockLogger,
      exit: mockExit,
    });

    await handler.handleSignal("SIGUSR1");

    expect(stopAllSpy).toHaveBeenCalledTimes(1);
    expect(onCreatePr).toHaveBeenCalledTimes(1);
    expect(exitCalls).toEqual([0]);
    expect(logs.some(l => l.includes("Stopped 2 active agent process(es)"))).toBe(true);

    stopAllSpy.mockRestore();
    handler.uninstall();
  });

  test("exits with 1 when onCreatePr throws an error", async () => {
    const onStopAgents = jest.fn(async () => {});
    const onCreatePr = jest.fn(async () => {
      throw new Error("Git push rejected");
    });

    const handler = setupRsiSignalHandler({
      onStopAgents,
      onCreatePr,
      logger: mockLogger,
      exit: mockExit,
    });

    await handler.handleSignal("SIGUSR2");

    expect(onStopAgents).toHaveBeenCalledTimes(1);
    expect(onCreatePr).toHaveBeenCalledTimes(1);
    expect(exitCalls).toEqual([1]);
    expect(errors.some(e => e.includes("Git push rejected"))).toBe(true);

    handler.uninstall();
  });

  test("continues to create PR even if onStopAgents throws an error", async () => {
    const onStopAgents = jest.fn(async () => {
      throw new Error("Failed to signal child process");
    });
    const onCreatePr = jest.fn(async () => {});

    const handler = setupRsiSignalHandler({
      onStopAgents,
      onCreatePr,
      logger: mockLogger,
      exit: mockExit,
    });

    await handler.handleSignal("SIGINT");

    expect(onStopAgents).toHaveBeenCalledTimes(1);
    expect(onCreatePr).toHaveBeenCalledTimes(1);
    expect(exitCalls).toEqual([0]);
    expect(errors.some(e => e.includes("Failed to signal child process"))).toBe(true);

    handler.uninstall();
  });
});
