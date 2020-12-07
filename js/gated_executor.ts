// @ts-ignore
import {promiseParts} from "./promises.ts";
// @ts-ignore
import {NullaryFunction} from "./types.ts";

/**
 * Collects functions that will be run once `declareReady()` has been called.
 *
 * If `declareReady()` has already been called, the functions will be executed immediately.
 */
export class GatedExecutor {
  ready = false;
  queue: NullaryFunction<any>[] = [];

  execute(fn: NullaryFunction<any>): Promise<any> {
    const [promise, resolve, reject] = promiseParts<any>();

    const wrapped: NullaryFunction<any> = () => {
      try {
        fn();
        resolve();
      } catch (e) {
        reject(e);
      }
    };

    if (this.ready) {
      wrapped();
    } else {
      this.queue.push(wrapped);
    }
    return promise;
  }

  declareReady(): void {
    if (this.ready) {
      throw new Error("Already ready!");
    }
    this.ready = true;
    this.queue.forEach(fn => fn());
    this.queue = [];
  }

  reset(): void {
    this.ready = false;
    this.queue = [];
  }
}
