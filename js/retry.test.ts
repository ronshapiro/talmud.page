// @ts-ignore
import {RetryMethodFactory} from "./retry.ts";

const noOpErrorsDelegate = {
  add: (id: string, message: string) => {}, // eslint-disable-line no-unused-vars
  remove: (id: string) => {}, // eslint-disable-line no-unused-vars
};

const factory = new RetryMethodFactory(noOpErrorsDelegate, () => {}, () => {});

const retryUnless = (condition: boolean, passAlongArg?: any): Promise<any> => {
  return new Promise((success, error) => {
    if (condition) {
      success(passAlongArg);
    } else {
      error(passAlongArg);
    }
  });
};

const testFinishHelpers = (): [() => void, Promise<any>] => {
  let endTest = () => {};
  // eslint-disable-next-line no-unused-vars
  const blockTestFinish = new Promise((success, error) => {
    endTest = () => success(null);
  });
  return [endTest, blockTestFinish];
};

test("Retries until success", () => {
  const [endTest, blockTestFinish] = testFinishHelpers();
  let counter = 0;
  factory.retryingMethod({
    retryingCall: () => {
      counter++;
      return retryUnless(counter === 3);
    },
    then: () => {
      expect(counter).toBe(3);
      endTest();
    },
  })();
  return blockTestFinish;
});


test("exponential backoff", () => {
  const [endTest, blockTestFinish] = testFinishHelpers();
  const timestamps: number[] = [];
  let counter = 0;
  factory.retryingMethod({
    retryingCall: () => {
      timestamps.push(new Date().getTime());
      counter++;
      return retryUnless(counter === 6);
    },
    then: () => {
      expect(timestamps.length).toBe(6);
      const MAX_DIFF = 10;
      const expectRange = (index: number, expectedAmount: number) => {
        expect(timestamps[index + 1] - timestamps[index]).toBeGreaterThanOrEqual(expectedAmount);
        expect(timestamps[index + 1] - timestamps[index]).toBeLessThan(expectedAmount + MAX_DIFF);
      };
      expectRange(0, 200);
      expectRange(1, 300);
      expectRange(2, 450);
      expectRange(3, 675);
      expectRange(4, 1012);
      endTest();
    },
  })();
  return blockTestFinish;
});

test("args are retained across retries", () => {
  const [endTest, blockTestFinish] = testFinishHelpers();
  let counter = 0;

  factory.retryingMethod({
    retryingCall: (...args: any[]) => {
      counter++;
      expect(args).toEqual(["a", "b", "c", 1, 2, 3]);
      return retryUnless(counter === 3, "pass along arg");
    },
    then: (passAlongArg: any) => {
      expect(counter).toBe(3);
      expect(passAlongArg).toBe("pass along arg");
      endTest();
    },
  })("a", "b", "c", 1, 2, 3);

  return blockTestFinish;
});

test("error message ids and creation", () => {
  const [endTest, blockTestFinish] = testFinishHelpers();
  let counter = 0;

  const errors: any[] = [];
  const errorFactory = new RetryMethodFactory({
    add: (id: string, message: string) => {
      errors.push({id, message, add: true});
    },
    remove: (id: string) => {
      errors.push({id, remove: true});
    },
  }, () => {}, () => {});

  errorFactory.retryingMethod({
    retryingCall: () => {
      counter++;
      return retryUnless(counter === 3);
    },
    createError: () => "Outer error",
    then: () => {
      let innerCounter = 0;
      errorFactory.retryingMethod({
        retryingCall: () => {
          innerCounter++;
          return retryUnless(innerCounter === 3);
        },
        createError: () => "Inner error",
        then: () => {
          expect(errors.length).toBe(6);

          expect(errors[0]).toEqual(errors[1]);
          expect(errors[0].add).toBe(true);
          expect(errors[2].remove).toBe(true);
          expect(errors[3]).toEqual(errors[4]);
          expect(errors[3].add).toBe(true);
          expect(errors[5].remove).toBe(true);

          expect(errors[0].id).toBe(errors[2].id);
          expect(errors[3].id).toBe(errors[5].id);

          expect(errors[0].id).not.toBe(errors[3].id);
          expect(errors[2].id).not.toBe(errors[5].id);

          endTest();
        },
      })();
    },
  })();

  return blockTestFinish;
});
