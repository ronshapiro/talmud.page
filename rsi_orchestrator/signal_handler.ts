import {stopAllActiveAgents} from "./agent_runner";

export const DEFAULT_RSI_SIGNALS: NodeJS.Signals[] = [
  "SIGINT",
  "SIGTERM",
  "SIGUSR1",
  "SIGUSR2",
];

export interface RsiSignalHandlerOptions {
  /**
   * Action to stop all active agents and abort runner execution.
   * If omitted, defaults to calling `stopAllActiveAgents()`.
   */
  onStopAgents?: () => void | Promise<void>;

  /**
   * Action to commit pending candidates, push to remote, and create/update the PR.
   */
  onCreatePr: () => Promise<void>;

  /**
   * Signals to register. Defaults to SIGINT, SIGTERM, SIGUSR1, SIGUSR2.
   */
  signals?: NodeJS.Signals[];

  /**
   * Logger instance for signal activity output.
   */
  logger?: {
    log: (msg: string) => void;
    error: (msg: string) => void;
  };

  /**
   * Process exit function, injectable for unit tests. Defaults to process.exit.
   */
  exit?: (code: number) => void;
}

export class RsiSignalHandler {
  private shuttingDown = false;
  private readonly listeners: Map<NodeJS.Signals, () => void> = new Map();

  constructor(private readonly options: RsiSignalHandlerOptions) {
    const signals = options.signals ?? DEFAULT_RSI_SIGNALS;
    for (const sig of signals) {
      const listener = () => {
        this.handleSignal(sig).catch(() => {});
      };
      this.listeners.set(sig, listener);
      try {
        process.on(sig, listener);
      } catch {
        // Ignore environments where specific signals cannot be registered
      }
    }
  }

  public isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  public async handleSignal(signal: NodeJS.Signals): Promise<void> {
    const logger = this.options.logger ?? console;
    const exit = this.options.exit ?? process.exit;

    if (this.shuttingDown) {
      logger.log(`\n[Signal] Received second ${signal}. Forcing immediate exit.`);
      exit(130);
      return;
    }

    this.shuttingDown = true;
    logger.log(`\n[Signal] Received ${signal}. Stopping all active agents and creating PR...`);

    try {
      // 1. Stop all active agents
      if (this.options.onStopAgents) {
        await this.options.onStopAgents();
      } else {
        const stopped = stopAllActiveAgents();
        logger.log(`[Signal] Stopped ${stopped} active agent process(es).`);
      }
    } catch (e) {
      logger.error(`[Signal] Error stopping active agents: ${e}`);
    }

    try {
      // 2. Commit pending candidates and create PR
      logger.log("[Signal] Creating PR for pending candidates...");
      await this.options.onCreatePr();
      logger.log("[Signal] PR creation completed successfully.");
    } catch (e) {
      logger.error(`[Signal] Error creating PR: ${e}`);
      exit(1);
      return;
    }

    // 3. Finish the process cleanly
    logger.log("[Signal] Process finished cleanly. Exiting.");
    exit(0);
  }

  public uninstall(): void {
    for (const [sig, listener] of this.listeners.entries()) {
      try {
        process.removeListener(sig, listener);
      } catch {
        // Ignore
      }
    }
    this.listeners.clear();
  }
}

export function setupRsiSignalHandler(options: RsiSignalHandlerOptions): RsiSignalHandler {
  return new RsiSignalHandler(options);
}
