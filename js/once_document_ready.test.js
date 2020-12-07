import {newOnReady as newInstance} from "./once_document_ready.js";

test("Nothing executed before declareReady() is called", () => {
  const onceDocumentReady = newInstance();
  const called = [];

  onceDocumentReady.execute(() => called.push(1));
  expect(called).toEqual([]);

  onceDocumentReady.declareReady();
  expect(called).toEqual([1]);
});


test("Functions are called in order", () => {
  const onceDocumentReady = newInstance();
  const called = [];

  onceDocumentReady.execute(() => called.push(1));
  onceDocumentReady.execute(() => called.push(2));

  onceDocumentReady.declareReady();
  expect(called).toEqual([1, 2]);
});


test("Functions are executed immediately after declareReady() is called", () => {
  const onceDocumentReady = newInstance();
  const called = [];

  onceDocumentReady.declareReady();

  onceDocumentReady.execute(() => called.push(1));
  expect(called).toEqual([1]);

  onceDocumentReady.execute(() => called.push(2));
  expect(called).toEqual([1, 2]);
});

test("Calling declareReady() twice throws", () => {
  const onceDocumentReady = newInstance();
  onceDocumentReady.declareReady();
  expect(() => onceDocumentReady.declareReady()).toThrow();
});


describe("execute() returns a Promise", () => {
  describe("already ready", () => {
    const instance = newInstance();
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
          throw new Error();
        },
      ).catch(() => expect(true).toBe(true));
    });
  });

  describe("not yet ready", () => {
    const instance = newInstance();

    test("onSuccess", () => {
      expect.assertions(1);
      return instance.execute(() => {})
        .then(() => expect(true).toBe(true));
    });
    test("onFailure", () => {
      expect.assertions(1);
      return instance.execute(
        () => {
          throw new Error();
        },
      ).catch(() => expect(true).toBe(true));
    });

    instance.declareReady();
  });
});
