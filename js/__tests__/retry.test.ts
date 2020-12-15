// @ts-ignore
import {RetryMethodFactory} from "../retry.ts";

const noOpErrorsDelegate = {
  add: (_id: string, _message: string) => {},
  remove: (_id: string) => {},
};

const fastSetTimeout = (callback: () => void) => {
  setTimeout(callback, 1);
};

const factory = new RetryMethodFactory(
  noOpErrorsDelegate, () => {},
  () => {},
  fastSetTimeout);

const retryUnless = (condition: boolean, passAlongArg?: any): Promise<any> => {
  return new Promise((success, error) => {
    if (condition) {
      success(passAlongArg);
    } else {
      error(passAlongArg);
    }
  });
};

test("Retries until success", () => {
  let counter = 0;
  return factory.retryingMethod({
    retryingCall: () => {
      counter++;
      return retryUnless(counter === 3);
    },
  })().then(() => {
    expect(counter).toBe(3);
  });
});


test("exponential backoff", () => {
  const timestamps: number[] = [];
  const recordingFactory = new RetryMethodFactory(
    noOpErrorsDelegate,
    () => {},
    () => {},
    (callback: () => void, ms: number) => {
      timestamps.push(ms);
      setTimeout(callback, 1);
    });

  let counter = 0;

  return recordingFactory.retryingMethod({
    retryingCall: () => {
      counter++;
      return retryUnless(counter === 10);
    },
  })().then(() => {
    expect(timestamps).toEqual([
      200,
      300,
      450,
      675,
      1012.5,
      1518.75,
      2278.125,
      3417.1875,
      5125.78125,
    ]);
  });
});

test("args are retained across retries", () => {
  let counter = 0;

  return factory.retryingMethod({
    retryingCall: (...args: any[]) => {
      counter++;
      expect(args).toEqual(["a", "b", "c", 1, 2, 3]);
      return retryUnless(counter === 3, "pass along arg");
    },
  })("a", "b", "c", 1, 2, 3)
    .then((passAlongArg: any) => {
      expect(counter).toBe(3);
      expect(passAlongArg).toBe("pass along arg");
    });
});

test("error message ids and creation", () => {
  let counter = 0;

  const errors: any[] = [];
  const errorFactory = new RetryMethodFactory({
    add: (id: string, message: string) => {
      errors.push({id, message, add: true});
    },
    remove: (id: string) => {
      errors.push({id, remove: true});
    },
  }, () => {}, () => {}, fastSetTimeout);

  return errorFactory.retryingMethod({
    retryingCall: () => {
      counter++;
      return retryUnless(counter === 3);
    },
    createError: () => "Outer error",
  })().then(() => {
    let innerCounter = 0;
    return errorFactory.retryingMethod({
      retryingCall: () => {
        innerCounter++;
        return retryUnless(innerCounter === 3);
      },
      createError: () => "Inner error",
    })();
  }).then(() => {
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
  });
});
