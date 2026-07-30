/**
 * Tests for the test harness itself — specifically the `act` wrappers in `testing/dom.tsx`, which
 * carry enough logic to be worth pinning. Everything else in `testing/` is plain construction.
 */
import * as React from "react";
import {flush, flushAsync, mount, unmountAll} from "./testing/dom";
import {clearPageEnvironment, installPageEnvironment} from "./testing/page_environment";

beforeEach(() => installPageEnvironment());
afterEach(() => {
  unmountAll();
  clearPageEnvironment();
});

describe("flush", () => {
  test("returns what the body returned", () => {
    expect(flush(() => 42)).toBe(42);
    expect(flush(() => "text")).toBe("text");
    expect(flush(() => ({a: 1}))).toEqual({a: 1});
  });

  test("returns undefined for a body that returns nothing", () => {
    expect(flush(() => {})).toBeUndefined();
  });

  test("applies state updates before returning", () => {
    let setValue: (x: number) => void = () => {};
    let rendered = 0;
    function Probe(): React.ReactElement {
      const [value, setter] = React.useState(0);
      setValue = setter;
      rendered = value;
      return <span>{value}</span>;
    }
    const container = mount(<Probe />);

    flush(() => setValue(7));

    expect(rendered).toBe(7);
    expect(container.textContent).toBe("7");
  });

  test("rejects an async body, which it cannot flush", () => {
    // A synchronous `act` returns before the promise settles, so anything the promise goes on to
    // schedule would land outside `act` and the test would assert against a half-settled tree.
    expect(() => flush(async () => undefined))
      .toThrow("flush() was given an async body; use flushAsync() so act() can await it");
  });

  test("rejects any thenable, not just a real promise", () => {
    expect(() => flush(() => ({then: () => {}}))).toThrow(/flushAsync/);
  });
});

describe("flushAsync", () => {
  test("returns what the body resolved to", async () => {
    await expect(flushAsync(async () => 42)).resolves.toBe(42);
  });

  test("accepts a synchronous body too", async () => {
    await expect(flushAsync(() => "text")).resolves.toBe("text");
  });

  test("can be called with no body, to settle pending work", async () => {
    await expect(flushAsync()).resolves.toBeUndefined();
  });

  test("applies state updates made after an await", async () => {
    let setValue: (x: number) => void = () => {};
    function Probe(): React.ReactElement {
      const [value, setter] = React.useState(0);
      setValue = setter;
      return <span>{value}</span>;
    }
    const container = mount(<Probe />);

    await flushAsync(async () => {
      await Promise.resolve();
      setValue(7);
    });

    expect(container.textContent).toBe("7");
  });

  test("settles promise chains the body only started", async () => {
    let resolved = false;
    const container = mount(<span>x</span>);

    await flushAsync(() => {
      Promise.resolve().then(() => Promise.resolve()).then(() => { resolved = true; });
    });

    expect(resolved).toBe(true);
    expect(container.textContent).toBe("x");
  });
});
