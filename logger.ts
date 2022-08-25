/* eslint-disable no-console */
import * as chalk from 'chalk';

export interface Logger {
  error: (...args: any[]) => void;
  log: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  newTimer: () => Timer;
}

export class Timer {
  constructor(private readonly logger: Logger, private readonly startTime = Date.now()) {}

  finish(description: string): void {
    const deltaInSeconds = (Date.now() - this.startTime) / 1000;
    this.logger.debug(description, "took", deltaInSeconds, "seconds");
  }
}

function replaceWithColor(color: (x: any) => string, args: any[]): any[] {
  if (!color) color = (x: any) => x; // for jest
  return args.map(x => {
    return ["string", "number"].includes(typeof x) ? color(x) : x;
  });
}

export class ConsoleLogger implements Logger {
  error(...args: any[]): void {
    console.error(...replaceWithColor(chalk.red, args));
  }

  log(...args: any[]): void {
    console.log(...args);
  }

  debug(...args: any[]): void {
    console.debug(...replaceWithColor(chalk.cyan, args));
  }

  newTimer(): Timer {
    return new Timer(this);
  }
}

export const consoleLogger = new ConsoleLogger();

export class NoopLogger implements Logger {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error(...args: any[]): void {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  log(...args: any[]): void {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  debug(...args: any[]): void {}

  newTimer(): Timer {
    return new Timer(this);
  }
}
