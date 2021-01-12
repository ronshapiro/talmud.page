/* eslint-disable no-console */

export interface Logger {
  error: (...args: any[]) => void;
  log: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  newTimer: () => Timer;
}

export class Timer {
  constructor(private readonly logger: Logger, private readonly startTime = new Date().getTime()) {}

  finish(description: string): void {
    const deltaInSeconds = (new Date().getTime() - this.startTime) / 1000;
    this.logger.debug(description, "took", deltaInSeconds, "seconds");
  }
}

class ConsoleLogger implements Logger {
  error(...args: any[]): void {
    console.error(...args);
  }

  log(...args: any[]): void {
    console.log(...args);
  }

  debug(...args: any[]): void {
    console.debug(...args);
  }

  newTimer(): Timer {
    return new Timer(this);
  }
}

export const consoleLogger = new ConsoleLogger();
