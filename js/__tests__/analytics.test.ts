import {trackEvent} from "../analytics";

afterEach(() => {
  delete (window as any).gtag;
});

test("does not throw when gtag is undefined", () => {
  expect(() => trackEvent("event", "some_event")).not.toThrow();
});

test("calls through to gtag when it's defined", () => {
  const calls: unknown[][] = [];
  (window as any).gtag = (...args: unknown[]) => calls.push(args);

  trackEvent("event", "some_event", {foo: "bar"});

  expect(calls).toEqual([["event", "some_event", {foo: "bar"}]]);
});
