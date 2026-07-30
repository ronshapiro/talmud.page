import * as React from "react";
import {useAlternator, useIncrementer, useUpdateDisplayTheme} from "../hooks";
import {useArrayStateBackedByLength} from "../state";
import {saveCustomTheme} from "../CustomThemes";
import {flush, mount, unmountAll} from "./testing/dom";
import {clearPageEnvironment, installPageEnvironment} from "./testing/page_environment";

beforeEach(() => installPageEnvironment());
afterEach(() => {
  unmountAll();
  clearPageEnvironment();
});

/** Renders `body` and exposes whatever it returns, plus a render count. */
function renderHook<T>(body: () => T): {current: T, renders: () => number} {
  let renderCount = 0;
  const result: {current: T, renders: () => number} = {
    current: undefined as any,
    renders: () => renderCount,
  };
  function Probe(): React.ReactElement {
    renderCount++;
    result.current = body();
    return <></>;
  }
  mount(<Probe />);
  return result;
}

describe("useIncrementer", () => {
  test("starts at zero and counts up", () => {
    const hook = renderHook(() => useIncrementer());

    expect(hook.current[0]).toBe(0);
    flush(() => hook.current[1]());
    expect(hook.current[0]).toBe(1);
    flush(() => hook.current[1]());
    expect(hook.current[0]).toBe(2);
  });

  test("accepts a starting value", () => {
    const hook = renderHook(() => useIncrementer(10));

    expect(hook.current[0]).toBe(10);
  });

  test("two increments in one batch both take effect", () => {
    // The setter uses the functional form, so batched calls do not clobber each other. This is
    // what makes it safe as the `forceUpdate` escape hatch in Root.
    const hook = renderHook(() => useIncrementer());

    flush(() => {
      hook.current[1]();
      hook.current[1]();
    });

    expect(hook.current[0]).toBe(2);
  });
});

describe("useAlternator", () => {
  test("flips between the two states", () => {
    const hook = renderHook(() => useAlternator(false));

    expect(hook.current[0]).toBe(false);
    flush(() => hook.current[1]());
    expect(hook.current[0]).toBe(true);
    flush(() => hook.current[1]());
    expect(hook.current[0]).toBe(false);
  });

  test("respects its initial value", () => {
    const hook = renderHook(() => useAlternator(true));

    expect(hook.current[0]).toBe(true);
  });
});

describe("useArrayStateBackedByLength", () => {
  test("returns the initial array", () => {
    const hook = renderHook(() => useArrayStateBackedByLength([1, 2, 3]));

    expect(hook.current[0]).toEqual([1, 2, 3]);
  });

  test("setting a new array of a different length re-renders with the new contents", () => {
    const hook = renderHook(() => useArrayStateBackedByLength([1, 2, 3]));

    flush(() => hook.current[1]([4, 5]));

    expect(hook.current[0]).toEqual([4, 5]);
  });

  test("re-setting a same-length array on every render terminates instead of looping", () => {
    // This is the entire reason the hook exists: React treats every `setState(<array>)` as a
    // change, so a component that recomputes and re-sets an equal array in an effect would
    // re-render forever. Backing the state with the length makes React bail out.
    let renders = 0;
    function Looper(): React.ReactElement {
      renders++;
      const [values, setValues] = useArrayStateBackedByLength([1, 2, 3]);
      React.useEffect(() => {
        setValues(values.map(x => x)); // a fresh array with identical contents
      });
      return <></>;
    }

    expect(() => mount(<Looper />)).not.toThrow();
    expect(renders).toBeLessThan(5);
  });

  test("the very first update always re-renders, since the length state starts at zero", () => {
    // TODO: this looks like it should be fixed — `useState(array.length)` instead of
    // `useState(0)` in js/state.ts would make the first update behave like every later one. The
    // extra render is harmless today, but it means the hook saves fewer renders than it appears
    // to, and the asymmetry is surprising. Changing it should make this test fail, at which point
    // it should be deleted rather than updated.
    // The backing state is `useState(0)` rather than `useState(array.length)`, so the first
    // update to a non-empty array is always seen as a change.
    const hook = renderHook(() => useArrayStateBackedByLength([1, 2, 3]));
    const before = hook.renders();

    flush(() => hook.current[1]([7, 8, 9]));

    expect(hook.renders()).toBe(before + 1);
  });

  test("the new contents are still visible on the next render", () => {
    const hook = renderHook(() => useArrayStateBackedByLength([1, 2, 3]));

    flush(() => hook.current[1]([7, 8, 9]));
    flush(() => hook.current[1]([7, 8])); // a length change forces a render

    expect(hook.current[0]).toEqual([7, 8]);
  });
});

describe("useUpdateDisplayTheme", () => {
  const darkModeCss = () => document.getElementById("darkModeCss") as HTMLLinkElement;
  const grayModeCss = () => document.getElementById("grayModeCss") as HTMLLinkElement;

  const renderTheme = () => renderHook(() => useUpdateDisplayTheme());

  test("light mode disables both alternate stylesheets", () => {
    localStorage.darkMode = "false";
    renderTheme();

    expect(darkModeCss().disabled).toBe(true);
    expect(grayModeCss().disabled).toBe(true);
  });

  test("dark mode enables only the dark stylesheet", () => {
    localStorage.darkMode = "true";
    renderTheme();

    expect(darkModeCss().disabled).toBe(false);
    expect(grayModeCss().disabled).toBe(true);
  });

  test("gray mode enables only the gray stylesheet", () => {
    localStorage.darkMode = "gray";
    renderTheme();

    expect(darkModeCss().disabled).toBe(true);
    expect(grayModeCss().disabled).toBe(false);
  });

  test("a custom theme applies its base stylesheet and its overrides", () => {
    saveCustomTheme({
      name: "Sepia",
      baseTheme: "gray",
      overrides: {"--background-color": "#f4ecd8"},
    });
    renderTheme();

    expect(grayModeCss().disabled).toBe(false);
    expect(document.documentElement.style.getPropertyValue("--background-color")).toBe("#f4ecd8");
  });

  test("switching away from a custom theme clears its overrides", () => {
    saveCustomTheme({
      name: "Sepia",
      baseTheme: "gray",
      overrides: {"--background-color": "#f4ecd8"},
    });
    const hook = renderTheme();
    expect(document.documentElement.getAttribute("style")).toContain("--background-color");

    localStorage.darkMode = "true";
    flush(() => hook.current); // no-op state read; the effect runs on every render
    unmountAll();
    renderTheme();

    expect(document.documentElement.style.getPropertyValue("--background-color")).toBe("");
  });

  test("the theme-color meta tags are refreshed", () => {
    localStorage.darkMode = "true";
    renderTheme();

    for (const id of ["theme-color", "theme-color-dark-mode"]) {
      expect((document.getElementById(id) as HTMLMetaElement).content).toEqual(expect.any(String));
    }
  });
});
