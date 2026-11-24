import {stopAllActiveAgents} from "./agent_runner";

export const DEFAULT_RSI_SIGNALS: NodeJS.Signals[] = [
  "SIGINT",
  "SIGTERM",
  "SIGUSR1",
  "SIGUSR2",
];

export const DEFAULT_GRACEFUL_SIGNALS: NodeJS.Signals[] = [
  "SIGINT",
];

export const DEFAULT_NPM_SIGINT_DUPLICATE_WINDOW_MILLISECONDS = 50;

export interface RsiSignalHandlerOptions {
  /**
   * Action to gracefully stop after the current unit of work (e.g. current comment) completes,
   * without cancelling active agents. Used on first receipt of any signal in `gracefulSignals`.
   */
  onGracefulStop?: () => void | Promise<void>;

  /**
   * Action to stop all active agents immediately and abort runner execution.
   * Used for immediate-stop signals (e.g. SIGTERM, SIGUSR1, SIGUSR2) or when `onGracefulStop`
   * is not provided. If omitted, defaults to calling `stopAllActiveAgents()`.
   */
  onStopAgents?: () => void | Promise<void>;

  /**
   * Synchronous action invoked when a second signal arrives during shutdown (e.g. second SIGINT)
   * to cancel active agents immediately before forcing exit. Defaults to `stopAllActiveAgents()`.
   */
  onForceCancel?: () => void;

  /**
   * Action to commit pending candidates, push to remote, and create/update the PR.
   */
  onCreatePr: () => Promise<void>;

  /**
   * Signals to register. Defaults to SIGINT, SIGTERM, SIGUSR1, SIGUSR2.
   */
  signals?: NodeJS.Signals[];

  /**
   * Signals that trigger graceful drain via `onGracefulStop` on first receipt before creating
   * the PR and exiting. Defaults to ["SIGINT"].
   */
  gracefulSignals?: NodeJS.Signals[];

  /**
   * Logger instance for signal activity output.
   */
  logger?: {
    log: (message: string) => void;
    error: (message: string) => void;
  };

  /**
   * Process exit function, injectable for unit tests. Defaults to process.exit.
   */
  exit?: (code: number) => void;

  /**
   * Clock source in milliseconds, injectable for unit tests. Defaults to Date.now.
   */
  now?: () => number;

  /**
   * Window in milliseconds to ignore at most one duplicate OS SIGINT echoed by npm/npx when
   * forwarding terminal Ctrl-C to the child process. Defaults to 50ms under npm/npx, 0 otherwise.
   */
  duplicateNpmSigintWindowMilliseconds?: number;
}

export class RsiSignalHandler {
  private shuttingDown = false;
  private forceExited = false;
  private shutdownPromise: Promise<void> | undefined;
  private firstOsSigintTimestampMilliseconds: number | undefined;
  private suppressedNpmSigintEcho = false;
  private readonly listeners: Map<NodeJS.Signals, () => void> = new Map();
  private readonly gracefulSignals: Set<NodeJS.Signals>;

  constructor(private readonly options: RsiSignalHandlerOptions) {
    const signals = options.signals ?? DEFAULT_RSI_SIGNALS;
    this.gracefulSignals = new Set(options.gracefulSignals ?? DEFAULT_GRACEFUL_SIGNALS);
    for (const signalName of signals) {
      const listener = () => {
        if (this.shouldIgnoreDuplicateNpmSigint(signalName)) {
          return;
        }
        this.handleSignal(signalName).catch(() => {});
      };
      this.listeners.set(signalName, listener);
      try {
        process.on(signalName, listener);
      } catch {
        // Ignore environments where specific signals cannot be registered
      }
    }
  }

  public isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  public waitForShutdown(): Promise<void> {
    return this.shutdownPromise ?? Promise.resolve();
  }

  private shouldIgnoreDuplicateNpmSigint(signalName: NodeJS.Signals): boolean {
    if (signalName !== "SIGINT") {
      return false;
    }
    const isNpmWrapper = process.env.npm_command === "exec"
      || process.env.npm_lifecycle_event === "npx"
      || process.env.npm_command === "run-script";
    const duplicateWindowMilliseconds = this.options.duplicateNpmSigintWindowMilliseconds
      ?? (isNpmWrapper ? DEFAULT_NPM_SIGINT_DUPLICATE_WINDOW_MILLISECONDS : 0);
    if (duplicateWindowMilliseconds <= 0) {
      return false;
    }
    // When running under `npx` or `npm`, a single terminal Ctrl-C delivers SIGINT to the child
    // both directly from the OS process group and forwarded by the npm wrapper within ~1ms.
    // Ignore at most that one immediate echo so one Ctrl-C is not treated as two SIGINTs.
    const currentTimestampMilliseconds = (this.options.now ?? Date.now)();
    if (this.firstOsSigintTimestampMilliseconds === undefined) {
      this.firstOsSigintTimestampMilliseconds = currentTimestampMilliseconds;
      return false;
    }
    if (!this.suppressedNpmSigintEcho
      && currentTimestampMilliseconds - this.firstOsSigintTimestampMilliseconds
        < duplicateWindowMilliseconds) {
      this.suppressedNpmSigintEcho = true;
      return true;
    }
    return false;
  }

  public async handleSignal(signal: NodeJS.Signals): Promise<void> {
    const logger = this.options.logger ?? console;
    const exit = this.options.exit ?? process.exit;

    if (this.shuttingDown) {
      this.forceExited = true;
      logger.log(`\n[Signal] Received second ${signal}. Forcing immediate exit.`);
      try {
        if (this.options.onForceCancel) {
          this.options.onForceCancel();
        } else {
          const stoppedCount = stopAllActiveAgents();
          if (stoppedCount > 0) {
            logger.log(`[Signal] Cancelled ${stoppedCount} active agent process(es).`);
          }
        }
      } catch (error) {
        logger.error(`[Signal] Error cancelling active agents: ${error}`);
      }
      exit(130);
      return;
    }

    this.shuttingDown = true;
    const shutdownExecution = this.executeShutdown(signal, logger, exit);
    this.shutdownPromise = shutdownExecution;
    await shutdownExecution;
  }

  private async executeShutdown(
    signal: NodeJS.Signals,
    logger: {log: (message: string) => void; error: (message: string) => void},
    exit: (code: number) => void,
  ): Promise<void> {
    const useGracefulStop = this.options.onGracefulStop && this.gracefulSignals.has(signal);

    if (useGracefulStop) {
      logger.log(
        `\n[Signal] Received ${signal}. Finishing current comment before creating PR and exiting `
        + `(send ${signal} again to cancel and quit immediately)...`,
      );
      try {
        await this.options.onGracefulStop!();
      } catch (error) {
        logger.error(`[Signal] Error waiting for graceful stop: ${error}`);
      }
    } else {
      logger.log(`\n[Signal] Received ${signal}. Stopping all active agents and creating PR...`);
      try {
        // 1. Stop all active agents
        if (this.options.onStopAgents) {
          await this.options.onStopAgents();
        } else {
          const stopped = stopAllActiveAgents();
          logger.log(`[Signal] Stopped ${stopped} active agent process(es).`);
        }
      } catch (error) {
        logger.error(`[Signal] Error stopping active agents: ${error}`);
      }
    }

    if (this.forceExited) {
      return;
    }

    try {
      // 2. Commit pending candidates and create PR
      logger.log("[Signal] Creating PR for pending candidates...");
      await this.options.onCreatePr();
      if (this.forceExited) {
        return;
      }
      logger.log("[Signal] PR creation completed successfully.");
    } catch (error) {
      if (this.forceExited) {
        return;
      }
      logger.error(`[Signal] Error creating PR: ${error}`);
      exit(1);
      return;
    }

    // 3. Finish the process cleanly
    logger.log("[Signal] Process finished cleanly. Exiting.");
    exit(0);
  }

  public uninstall(): void {
    for (const [signalName, listener] of this.listeners.entries()) {
      try {
        process.removeListener(signalName, listener);
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
