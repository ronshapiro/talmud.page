import {promiseParts} from "./promises";
import {NullaryFunction} from "./types";

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
        const wrappedReturnValue = fn();
        if (wrappedReturnValue instanceof Promise) {
          wrappedReturnValue.then(x => resolve(x), e => reject(e));
        } else {
          resolve(wrappedReturnValue);
        }
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
