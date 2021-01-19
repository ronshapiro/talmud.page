import {GatedExecutor} from "../gated_executor";
import {promiseParts} from "../promises";

test("Nothing executed before declareReady() is called", () => {
  const onceDocumentReady = new GatedExecutor();
  const called: number[] = [];

  onceDocumentReady.execute(() => called.push(1));
  expect(called).toEqual([]);

  onceDocumentReady.declareReady();
  expect(called).toEqual([1]);
});


test("Functions are called in order", () => {
  const onceDocumentReady = new GatedExecutor();
  const called: number[] = [];

  onceDocumentReady.execute(() => called.push(1));
  onceDocumentReady.execute(() => called.push(2));

  onceDocumentReady.declareReady();
  expect(called).toEqual([1, 2]);
});


test("Functions are executed immediately after declareReady() is called", () => {
  const onceDocumentReady = new GatedExecutor();
  const called: number[] = [];

  onceDocumentReady.declareReady();

  onceDocumentReady.execute(() => called.push(1));
  expect(called).toEqual([1]);

  onceDocumentReady.execute(() => called.push(2));
  expect(called).toEqual([1, 2]);
});

test("Calling declareReady() twice throws", () => {
  const onceDocumentReady = new GatedExecutor();
  onceDocumentReady.declareReady();
  expect(() => onceDocumentReady.declareReady()).toThrow();
});

describe("execute() returns a Promise", () => {
  describe("already ready", () => {
    const instance = new GatedExecutor();
    instance.declareReady();

    test("onSuccess", () => {
      expect.assertions(1);
      return instance.execute(() => {})
        .then(() => expect(true).toBe(true));
    });

    test("onFailure", () => {
      expect.assertions(1);
      return instance.execute(
        () => {
          throw new Error("Expected to fail");
        },
      ).catch(() => expect(true).toBe(true));
    });
  });

  describe("not yet ready", () => {
    const instance = new GatedExecutor();

    test("onSuccess", () => {
      expect.assertions(1);
      return instance.execute(() => {})
        .then(() => expect(true).toBe(true));
    });
    test("onFailure", () => {
      expect.assertions(1);
      return instance.execute(
        () => {
          throw new Error("Expected to fail");
        },
      ).catch(() => expect(true).toBe(true));
    });

    instance.declareReady();
  });
});

function waitingSuccessfulPromise(): Promise<any> {
  const [promise, success] = promiseParts();
  setTimeout(() => success(""), 200);
  return promise;
}

function waitingFailedPromise(): Promise<any> {
  const [promise, , failure] = promiseParts();
  setTimeout(() => failure(""), 200);
  return promise;
}

describe("method passed to execute() returns a Promise that is chained", () => {
  describe("already ready", () => {
    const instance = new GatedExecutor();
    instance.declareReady();

    test("onSuccess", () => {
      expect.assertions(1);
      return instance.execute(() => waitingSuccessfulPromise())
        .then(() => expect(true).toBe(true));
    });

    test("onFailure", () => {
      expect.assertions(1);
      return instance.execute(() => waitingFailedPromise())
        .catch(() => expect(true).toBe(true));
    });
  });

  describe("not yet ready", () => {
    test("onSuccess", () => {
      const instance = new GatedExecutor();
      let called = false;
      const promise = instance.execute(() => {
        called = true;
        return waitingSuccessfulPromise();
      });
      expect(called).toBe(false);
      instance.declareReady();
      expect.assertions(2);
      return promise.then(() => expect(called).toBe(true));
    });

    test("onFailure", () => {
      const instance = new GatedExecutor();
      let called = false;
      const promise = instance.execute(() => {
        called = true;
        return waitingFailedPromise();
      });
      expect(called).toBe(false);
      instance.declareReady();
      expect.assertions(2);
      return promise.catch(() => expect(called).toBe(true));
    });
  });
});
