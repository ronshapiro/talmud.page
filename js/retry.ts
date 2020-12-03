import {v4 as uuid} from "uuid";

class RetryState {
  delay: number
  id: string

  constructor(delay = 200) {
    this.delay = delay;
    this.id = uuid();
  }

  increment() {
    this.delay *= 1.5;
  }
}

interface AnyFunction {
  (...params: any[]): any;
}

interface RetryingMethodOptions {
  retryingCall: (...params: any[]) => Promise<any>;
  then: (successValue?: any) => void;
  createError?: (...params: any[]) => string;
}

interface ErrorsDelegate {
  add: (id: string, errorMessage: string) => void;
  remove: (id: string) => void;
}

interface GeneratedRetryingMethodSignature {
  (...params: any[]): Promise<any>;
}

export class RetryMethodFactory {
  errorsDelegate: ErrorsDelegate;
  onErrorStateChange: () => void;
  errorLogger: AnyFunction;

  constructor(
    errorsDelegate: ErrorsDelegate,
    onErrorStateChange: () => void,
    errorLogger: AnyFunction = console.error) {
    this.errorsDelegate = errorsDelegate;
    this.onErrorStateChange = onErrorStateChange;
    this.errorLogger = errorLogger;
  }

  /**
   * Retries the method specified in `options.retryingCall` until it succeeds, and then calls
   * `options.then`.
   */
  // TODO: make this return a proper promise that only succeeds after everything is finally
  // successful.
  retryingMethod(options: RetryingMethodOptions): GeneratedRetryingMethodSignature {
    const doCall: GeneratedRetryingMethodSignature = (...args) => {
      let retryState: RetryState;
      const lastArg = args.slice(-1)[0];
      if (args.length > 0 && lastArg instanceof RetryState) {
        retryState = lastArg;
        args = args.slice(0, -1);
      } else {
        retryState = new RetryState();
      }
      return options.retryingCall(...args)
        .then(
          (...thenArgs: any[]) => {
            this.errorsDelegate.remove(retryState.id);
            this.onErrorStateChange();
            options.then(...thenArgs);
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
            setTimeout(() => {
              retryState.increment();
              doCall(...args, retryState);
            }, retryState.delay);
          });
    };
    return doCall;
  }
}
