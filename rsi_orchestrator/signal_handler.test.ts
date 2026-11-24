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
    expect(logs.some(log => log.includes("Received SIGINT"))).toBe(true);
    expect(logs.some(log => log.includes("Creating PR"))).toBe(true);
    expect(logs.some(log => log.includes("Process finished cleanly"))).toBe(true);

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
    expect(logs.some(log => log.includes("Received second SIGINT. Forcing immediate exit"))).toBe(true);

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
    expect(logs.some(log => log.includes("Stopped 2 active agent process(es)"))).toBe(true);

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
    expect(errors.some(error => error.includes("Git push rejected"))).toBe(true);

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
    expect(errors.some(error => error.includes("Failed to signal child process"))).toBe(true);

    handler.uninstall();
  });

  test("first SIGINT drains via onGracefulStop before creating PR and exiting cleanly", async () => {
    let resolveDrain!: () => void;
    const drainPromise = new Promise<void>(resolve => {
      resolveDrain = resolve;
    });
    const onGracefulStop = jest.fn(async () => {
      await drainPromise;
    });
    const onStopAgents = jest.fn(async () => {});
    const onForceCancel = jest.fn();
    const onCreatePr = jest.fn(async () => {});
    const stopAllSpy = jest.spyOn(agentRunner, "stopAllActiveAgents").mockReturnValue(0);

    const handler = setupRsiSignalHandler({
      onGracefulStop,
      onStopAgents,
      onForceCancel,
      onCreatePr,
      logger: mockLogger,
      exit: mockExit,
    });

    const signalPromise = handler.handleSignal("SIGINT");
    expect(handler.isShuttingDown()).toBe(true);
    expect(onGracefulStop).toHaveBeenCalledTimes(1);
    expect(onStopAgents).not.toHaveBeenCalled();
    expect(stopAllSpy).not.toHaveBeenCalled();
    expect(onForceCancel).not.toHaveBeenCalled();
    expect(onCreatePr).not.toHaveBeenCalled();
    expect(exitCalls).toEqual([]);

    resolveDrain();
    await signalPromise;
    await handler.waitForShutdown();

    expect(onStopAgents).not.toHaveBeenCalled();
    expect(stopAllSpy).not.toHaveBeenCalled();
    expect(onForceCancel).not.toHaveBeenCalled();
    expect(onCreatePr).toHaveBeenCalledTimes(1);
    expect(exitCalls).toEqual([0]);
    expect(logs.some(log => log.includes("Finishing current comment"))).toBe(true);

    stopAllSpy.mockRestore();
    handler.uninstall();
  });

  test("second SIGINT during graceful drain forces immediate cancel and exit 130 without creating PR", async () => {
    let resolveDrain!: () => void;
    const drainPromise = new Promise<void>(resolve => {
      resolveDrain = resolve;
    });
    const onGracefulStop = jest.fn(async () => {
      await drainPromise;
    });
    const onForceCancel = jest.fn();
    const onCreatePr = jest.fn(async () => {});

    const handler = setupRsiSignalHandler({
      onGracefulStop,
      onForceCancel,
      onCreatePr,
      logger: mockLogger,
      exit: mockExit,
    });

    const firstPromise = handler.handleSignal("SIGINT");
    expect(onCreatePr).not.toHaveBeenCalled();

    await handler.handleSignal("SIGINT");
    expect(onForceCancel).toHaveBeenCalledTimes(1);
    expect(exitCalls).toEqual([130]);
    expect(logs.some(log => log.includes("Received second SIGINT. Forcing immediate exit"))).toBe(true);

    resolveDrain();
    await firstPromise;
    await handler.waitForShutdown();

    expect(onCreatePr).not.toHaveBeenCalled();
    expect(exitCalls).toEqual([130]);

    handler.uninstall();
  });

  test("second SIGINT during PR creation after graceful drain forces exit 130", async () => {
    let resolvePr!: () => void;
    const prPromise = new Promise<void>(resolve => {
      resolvePr = resolve;
    });
    const onGracefulStop = jest.fn(async () => {});
    const onForceCancel = jest.fn();
    const onCreatePr = jest.fn(async () => {
      await prPromise;
    });

    const handler = setupRsiSignalHandler({
      onGracefulStop,
      onForceCancel,
      onCreatePr,
      logger: mockLogger,
      exit: mockExit,
    });

    const firstPromise = handler.handleSignal("SIGINT");
    await Promise.resolve();
    await Promise.resolve();
    expect(onCreatePr).toHaveBeenCalledTimes(1);

    await handler.handleSignal("SIGINT");
    expect(onForceCancel).toHaveBeenCalledTimes(1);
    expect(exitCalls).toEqual([130]);

    resolvePr();
    await firstPromise;
    expect(exitCalls).toEqual([130]);

    handler.uninstall();
  });

  test("SIGTERM still calls onStopAgents immediately even when onGracefulStop is configured", async () => {
    const onGracefulStop = jest.fn(async () => {});
    const onStopAgents = jest.fn(async () => {});
    const onCreatePr = jest.fn(async () => {});

    const handler = setupRsiSignalHandler({
      onGracefulStop,
      onStopAgents,
      onCreatePr,
      logger: mockLogger,
      exit: mockExit,
    });

    await handler.handleSignal("SIGTERM");

    expect(onGracefulStop).not.toHaveBeenCalled();
    expect(onStopAgents).toHaveBeenCalledTimes(1);
    expect(onCreatePr).toHaveBeenCalledTimes(1);
    expect(exitCalls).toEqual([0]);

    handler.uninstall();
  });

  test("ignores one duplicate OS SIGINT echo within the npm/npx window, then forces exit on next SIGINT", async () => {
    let currentTimeMilliseconds = 1000;
    let resolveDrain!: () => void;
    const onGracefulStop = jest.fn(() => new Promise<void>(resolve => {
      resolveDrain = resolve;
    }));
    const onForceCancel = jest.fn();
    const onCreatePr = jest.fn(async () => {});

    const handler = setupRsiSignalHandler({
      signals: ["SIGINT"],
      onGracefulStop,
      onForceCancel,
      onCreatePr,
      logger: mockLogger,
      exit: mockExit,
      now: () => currentTimeMilliseconds,
      duplicateNpmSigintWindowMilliseconds: 50,
    });

    // First OS SIGINT (from terminal Ctrl-C)
    process.emit("SIGINT", "SIGINT");
    expect(handler.isShuttingDown()).toBe(true);
    expect(onGracefulStop).toHaveBeenCalledTimes(1);
    expect(exitCalls).toEqual([]);

    // Echoed SIGINT 1ms later from npx wrapper is ignored
    currentTimeMilliseconds = 1001;
    process.emit("SIGINT", "SIGINT");
    expect(onForceCancel).not.toHaveBeenCalled();
    expect(exitCalls).toEqual([]);

    // Real second Ctrl-C 200ms later cancels and exits immediately
    currentTimeMilliseconds = 1200;
    process.emit("SIGINT", "SIGINT");
    expect(onForceCancel).toHaveBeenCalledTimes(1);
    expect(exitCalls).toEqual([130]);

    resolveDrain();
    await handler.waitForShutdown();
    handler.uninstall();
  });
});
