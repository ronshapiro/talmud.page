import {v4 as uuid} from "uuid";
import {promiseParts} from "./promises";
import {BinaryFunction} from "./types";

class RetryState {
  delay: number
  id: string
  promise: Promise<any>
  proceed: (_t: any) => void

  constructor(delay = 200) {
    this.delay = delay;
    this.id = uuid();
    [this.promise, this.proceed] = promiseParts<any>();
  }

  increment() {
    this.delay *= 1.5;
  }
}

interface AnyFunction {
  (..._params: any[]): any;
}

interface RetryingMethodOptions {
  retryingCall: (..._params: any[]) => Promise<any>;
  then?: (_successValue?: any) => void;
  createError?: (..._params: any[]) => string | undefined;
}

interface ErrorsDelegate {
  add: (_id: string, _errorMessage: string) => void;
  remove: (_id: string) => void;
}

interface GeneratedRetryingMethodSignature {
  (..._params: any[]): Promise<any>;
}

type SetTimeout = BinaryFunction<() => void, number, void>;

export class RetryMethodFactory {
  errorsDelegate: ErrorsDelegate;
  onErrorStateChange: () => void;
  errorLogger: AnyFunction;
  setTimeout: SetTimeout;

  constructor(
    errorsDelegate: ErrorsDelegate,
    onErrorStateChange: () => void,
    errorLogger: AnyFunction = console.error,
    setTimeoutDelegate: SetTimeout = setTimeout) {
    this.errorsDelegate = errorsDelegate;
    this.onErrorStateChange = onErrorStateChange;
    this.errorLogger = errorLogger;
    this.setTimeout = (callback: () => void, delay: number) => setTimeoutDelegate(callback, delay);
  }

  /**
   * Returns a function that will call `options.retryingCall` repeatedly until it succeeds,
   * implementing a backoff policy upon failed calls.
   *
   * The returned `Promise` _never_ fails; it will succeed once the `options.retryingCall`
   * eventually has a successful promise.
   *
   * If a function is provided as `options.then`, the returned `Promise` will have it chained. Note
   * that this is not identical to chaining `then()` calls on the returned promise in `retryingCall`
   * - a failure in `options.then` will *not* cause `options.retryingCall` to be retried, but a
   * failure in a `then()` chained to the `retryingCall` result will cause the entire call to be
   * retried.
   *
   * If a function is provided as `options.createError`, it will be called to create an error
   * if `options.retryingCall` fails.
   */
  retryingMethod(options: RetryingMethodOptions): GeneratedRetryingMethodSignature {
    const doCall: GeneratedRetryingMethodSignature = (...args) => {
      let retryState: RetryState;
      const lastArg = args.slice(-1)[0];
      if (args.length > 0 && lastArg instanceof RetryState) {
        retryState = lastArg;
        args = args.slice(0, -1);
      } else {
        retryState = new RetryState();
        const _then = options.then; // tsc seems to get confused if `const then = {options}` is used
        if (_then) {
          retryState.promise = retryState.promise.then((thenArg) => _then(thenArg));
        }
      }

      options.retryingCall(...args)
        .then(
          (thenArg: any) => {
            this.errorsDelegate.remove(retryState.id);
            this.onErrorStateChange();
            retryState.proceed(thenArg);
          },
          (errorResponse: any) => {
            this.errorLogger(errorResponse);
            this.errorLogger(options);
            if (options.createError) {
              const userVisibleMessage = options.createError(...args);
              if (userVisibleMessage) {
                this.errorsDelegate.add(retryState.id, userVisibleMessage);
                this.onErrorStateChange();
              }
            }
            this.setTimeout(() => {
              retryState.increment();
              doCall(...args, retryState);
            }, retryState.delay);
          });
      return retryState.promise;
    };
    return doCall;
  }
}
