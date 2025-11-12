export function promiseParts<T>(): [Promise<T>, (t: T) => void, (t: T) => void] {
  let onSuccess = (_t: T) => {};
  let onError = (_t: T) => {};
  const promise = new Promise<T>((success, error) => {
    onSuccess = success;
    onError = error;
  });
  return [promise, onSuccess, onError];
}

export function asPromise<T>(thenable: PromiseLike<T>): Promise<T> {
  return Promise.all([thenable]).then(x => x[0]);
}

// TODO: replace PromiseChain with PromiseQueue(1)
export class PromiseChain {
  constructor(private serializer: Promise<unknown> = Promise.resolve(undefined)) {}

  add(serializedFunction: () => any): this {
    this.serializer = this.serializer.then(() => serializedFunction()).catch(() => {});
    return this;
  }
}

export class PromiseQueue {
  private queue: (() => Promise<unknown>)[] = [];
  private nextThreads: Promise<unknown>[] = [];
  private allPromises: Promise<unknown>[] = [];

  constructor(size: number) {
    for (let i = 0; i < size; i++) {
      this.nextThreads.push(Promise.resolve(undefined));
    }
  }

  add(fn: () => Promise<unknown>): void {
    const [promise, markFinished] = promiseParts();
    this.addWrapped(() => fn().then(() => markFinished(undefined)));
    this.allPromises.push(promise);
  }

  private addWrapped(fn: () => Promise<unknown>): void {
    const nextThread = this.nextThreads.shift();
    if (nextThread) {
      nextThread
        .then(() => fn())
        .catch((e) => {
          console.error(e); // eslint-disable-line no-console
        })
        .then(() => {
          const nextFn = this.queue.shift();
          if (nextFn) {
            this.nextThreads.push(nextThread);
            this.addWrapped(nextFn);
          }
        });
      return;
    }

    this.queue.push(fn);
  }

  asPromise(): Promise<unknown> {
    console.log(this.allPromises.length);
    return Promise.allSettled(this.allPromises);
  }
}

export function timeoutPromise(delay: number): Promise<unknown> {
  const [promise, onSuccess] = promiseParts();
  setTimeout(onSuccess, delay);
  return promise;
}
