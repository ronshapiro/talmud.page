import * as React from "react";
import {act} from "react-dom/test-utils";
import TableRow from "../TableRow";
import {
  DoubleClickHintSurfaceType,
  DoubleClickVisualHint,
  claimDoubleClickVisualHint,
  recordDoubleClickInteraction,
  recordDoubleClickVisualHintDisplayed,
  resetDoubleClickVisualHintState,
  shouldDisplayDoubleClickVisualHint,
  useDoubleClickVisualHint,
} from "../DoubleClickVisualHint";
import {TestContext} from "./testing/configuration";
import {
  doubleClick,
  mount,
  query,
  queryOrNull,
  unmountAll,
} from "./testing/dom";
import {clearPageEnvironment, installPageEnvironment} from "./testing/page_environment";

beforeEach(() => {
  installPageEnvironment();
  resetDoubleClickVisualHintState();
});

afterEach(() => {
  unmountAll();
  clearPageEnvironment();
  resetDoubleClickVisualHintState();
  jest.useRealTimers();
});

describe("DoubleClickVisualHint unit logic", () => {
  test("displays hint initially when no prior interaction or display exists", () => {
    expect(shouldDisplayDoubleClickVisualHint(DoubleClickHintSurfaceType.STEINSALTZ)).toBe(true);
    expect(
      shouldDisplayDoubleClickVisualHint(DoubleClickHintSurfaceType.RASHI_EXPLANATION),
    ).toBe(true);
  });

  test("does not display if double-tapped within the last month", () => {
    const currentTimestamp = 1000000000000;
    const twentyDaysAgo = currentTimestamp - 20 * 24 * 60 * 60 * 1000;

    recordDoubleClickInteraction(DoubleClickHintSurfaceType.STEINSALTZ, twentyDaysAgo);

    expect(
      shouldDisplayDoubleClickVisualHint(DoubleClickHintSurfaceType.STEINSALTZ, currentTimestamp),
    ).toBe(false);
    expect(
      shouldDisplayDoubleClickVisualHint(
        DoubleClickHintSurfaceType.RASHI_EXPLANATION,
        currentTimestamp,
      ),
    ).toBe(true);
  });

  test("displays if last double-tap was more than a month ago", () => {
    const currentTimestamp = 1000000000000;
    const fortyDaysAgo = currentTimestamp - 40 * 24 * 60 * 60 * 1000;

    recordDoubleClickInteraction(DoubleClickHintSurfaceType.STEINSALTZ, fortyDaysAgo);

    expect(
      shouldDisplayDoubleClickVisualHint(DoubleClickHintSurfaceType.STEINSALTZ, currentTimestamp),
    ).toBe(true);
  });

  test("does not display if already displayed within the last month", () => {
    const currentTimestamp = 1000000000000;
    const tenDaysAgo = currentTimestamp - 10 * 24 * 60 * 60 * 1000;

    localStorage.setItem(
      `doubleClickHint.lastDisplayed.${DoubleClickHintSurfaceType.STEINSALTZ}`,
      tenDaysAgo.toString(),
    );

    expect(
      shouldDisplayDoubleClickVisualHint(DoubleClickHintSurfaceType.STEINSALTZ, currentTimestamp),
    ).toBe(false);
  });

  test("displays if last display was more than a month ago", () => {
    const currentTimestamp = 1000000000000;
    const thirtyFiveDaysAgo = currentTimestamp - 35 * 24 * 60 * 60 * 1000;

    localStorage.setItem(
      `doubleClickHint.lastDisplayed.${DoubleClickHintSurfaceType.STEINSALTZ}`,
      thirtyFiveDaysAgo.toString(),
    );

    expect(
      shouldDisplayDoubleClickVisualHint(DoubleClickHintSurfaceType.STEINSALTZ, currentTimestamp),
    ).toBe(true);
  });

  test("claimDoubleClickVisualHint claims session without writing to localStorage yet", () => {
    const currentTimestamp = 1000000000000;

    const firstClaimSuccess = claimDoubleClickVisualHint(
      DoubleClickHintSurfaceType.STEINSALTZ,
      currentTimestamp,
    );
    expect(firstClaimSuccess).toBe(true);
    // Not recorded as seen in localStorage until N pulsations complete or double tapped:
    expect(
      localStorage.getItem(`doubleClickHint.lastDisplayed.${DoubleClickHintSurfaceType.STEINSALTZ}`),
    ).toBeNull();

    // Subsequent claim in same session fails:
    const secondClaimSuccess = claimDoubleClickVisualHint(
      DoubleClickHintSurfaceType.STEINSALTZ,
      currentTimestamp + 100,
    );
    expect(secondClaimSuccess).toBe(false);
  });

  test("recordDoubleClickVisualHintDisplayed records timestamp to localStorage", () => {
    const currentTimestamp = 1000000000000;
    recordDoubleClickVisualHintDisplayed(DoubleClickHintSurfaceType.STEINSALTZ, currentTimestamp);

    expect(
      localStorage.getItem(`doubleClickHint.lastDisplayed.${DoubleClickHintSurfaceType.STEINSALTZ}`),
    ).toBe(currentTimestamp.toString());
  });
});

describe("useDoubleClickVisualHint hook", () => {
  function TestHookComponent({
    surfaceType,
    onDoubleClick,
  }: {
    surfaceType?: DoubleClickHintSurfaceType;
    onDoubleClick?: () => void;
  }) {
    const {visualIndicator, doubleClickListener, isVisualHintActive} = useDoubleClickVisualHint(
      surfaceType,
      onDoubleClick,
    );
    return (
      <div data-active={isVisualHintActive}>
        <button
          type="button"
          onClick={doubleClickListener}
          className="test-trigger"
        >
          Click
        </button>
        {visualIndicator}
      </div>
    );
  }

  test("returns visual indicator and wraps double-click listener", () => {
    const listener = jest.fn();
    const root = mount(
      <TestContext>
        <TestHookComponent
          surfaceType={DoubleClickHintSurfaceType.STEINSALTZ}
          onDoubleClick={listener}
        />
      </TestContext>,
    );

    expect(queryOrNull(root, ".double-click-hint-overlay")).not.toBeNull();
    const button = query(root, ".test-trigger");

    act(() => {
      button.click();
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(queryOrNull(root, ".double-click-hint-overlay")).toBeNull();
    expect(
      localStorage.getItem(`doubleClickHint.lastDoubleTap.${DoubleClickHintSurfaceType.STEINSALTZ}`),
    ).not.toBeNull();
  });
});

describe("DoubleClickVisualHint component lifecycle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  test("starts after initial delay, pulsates and pauses, and records as seen after N cycles", () => {
    const onFinished = jest.fn();
    const root = mount(
      <DoubleClickVisualHint
        surfaceType={DoubleClickHintSurfaceType.STEINSALTZ}
        onFinished={onFinished}
        pulseCycleCount={2}
        initialDelayMilliseconds={500}
        pulseDurationMilliseconds={400}
        pauseDurationMilliseconds={200}
      />,
    );

    const overlay = query(root, ".double-click-hint-overlay");
    expect(overlay).not.toBeNull();
    // Before initial delay, not yet pulsating:
    expect(overlay.classList.contains("is-pulsating")).toBe(false);
    expect(
      localStorage.getItem(`doubleClickHint.lastDisplayed.${DoubleClickHintSurfaceType.STEINSALTZ}`),
    ).toBeNull();

    // Advance through initial delay:
    act(() => {
      jest.advanceTimersByTime(500);
    });
    // Cycle 1 is now pulsating:
    expect(query(root, ".double-click-hint-overlay").classList.contains("is-pulsating")).toBe(true);
    expect(query(root, ".double-click-hint-overlay").getAttribute("data-cycle")).toBe("1");
    expect(
      localStorage.getItem(`doubleClickHint.lastDisplayed.${DoubleClickHintSurfaceType.STEINSALTZ}`),
    ).toBeNull();

    // Advance through pulse duration:
    act(() => {
      jest.advanceTimersByTime(400);
    });
    // Now in pause / disappeared state:
    expect(query(root, ".double-click-hint-overlay").classList.contains("is-pulsating")).toBe(false);

    // Advance through pause duration:
    act(() => {
      jest.advanceTimersByTime(200);
    });
    // Cycle 2 (the 2nd and final cycle) is now pulsating:
    expect(query(root, ".double-click-hint-overlay").classList.contains("is-pulsating")).toBe(true);
    expect(query(root, ".double-click-hint-overlay").getAttribute("data-cycle")).toBe("2");
    expect(
      localStorage.getItem(`doubleClickHint.lastDisplayed.${DoubleClickHintSurfaceType.STEINSALTZ}`),
    ).toBeNull();

    // Advance through pulse duration of cycle 2:
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(query(root, ".double-click-hint-overlay").classList.contains("is-pulsating")).toBe(false);

    // Advance through pause duration after cycle 2:
    act(() => {
      jest.advanceTimersByTime(200);
    });

    // All cycles finished! Recorded as seen and removed:
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(queryOrNull(root, ".double-click-hint-overlay")).toBeNull();
    expect(
      localStorage.getItem(`doubleClickHint.lastDisplayed.${DoubleClickHintSurfaceType.STEINSALTZ}`),
    ).not.toBeNull();
  });
});

describe("TableRow double-click visual hint integration", () => {
  function renderRow(
    properties: Partial<React.ComponentProps<typeof TableRow>> = {},
    contextOverrides = {},
  ): HTMLElement {
    return mount(
      <TestContext overrides={contextOverrides}>
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <TableRow classes={[]} {...properties} />
      </TestContext>,
    );
  }

  test("renders overlay on double-clickable row and dismisses on double-click", () => {
    const doubleClickListener = jest.fn();
    const root = renderRow({
      hebrew: "מאימתי קורין את שמע",
      hebrewDoubleClickListener: doubleClickListener,
      doubleClickHintSurfaceType: DoubleClickHintSurfaceType.STEINSALTZ,
    });

    const cell = query(root, ".table-cell.hebrew");
    expect(cell.classList.contains("has-double-click-hint")).toBe(true);
    const hintElement = queryOrNull(root, ".double-click-hint-overlay");
    expect(hintElement).not.toBeNull();

    // Double clicking the row triggers the listener and immediately records double-tap:
    doubleClick(cell);
    expect(doubleClickListener).toHaveBeenCalledTimes(1);

    expect(queryOrNull(root, ".double-click-hint-overlay")).toBeNull();
    expect(
      localStorage.getItem(`doubleClickHint.lastDoubleTap.${DoubleClickHintSurfaceType.STEINSALTZ}`),
    ).not.toBeNull();
  });

  test("does not render visual hint on hidden host (isFake)", () => {
    const doubleClickListener = jest.fn();
    const root = renderRow(
      {
        hebrew: "מאימתי קורין את שמע",
        hebrewDoubleClickListener: doubleClickListener,
        doubleClickHintSurfaceType: DoubleClickHintSurfaceType.STEINSALTZ,
      },
      {isFake: true},
    );

    expect(queryOrNull(root, ".double-click-hint-overlay")).toBeNull();
  });

  test("does not render hint if double-tap happened within last month", () => {
    const currentTimestamp = Date.now();
    recordDoubleClickInteraction(DoubleClickHintSurfaceType.STEINSALTZ, currentTimestamp);

    const doubleClickListener = jest.fn();
    const root = renderRow({
      hebrew: "מאימתי קורין את שמע",
      hebrewDoubleClickListener: doubleClickListener,
      doubleClickHintSurfaceType: DoubleClickHintSurfaceType.STEINSALTZ,
    });

    expect(queryOrNull(root, ".double-click-hint-overlay")).toBeNull();
  });

  test("only one row of that surface type claims and displays the hint", () => {
    const doubleClickListenerFirst = jest.fn();
    const doubleClickListenerSecond = jest.fn();

    const rootFirst = renderRow({
      hebrew: "שורה ראשונה",
      hebrewDoubleClickListener: doubleClickListenerFirst,
      doubleClickHintSurfaceType: DoubleClickHintSurfaceType.STEINSALTZ,
    });

    const rootSecond = renderRow({
      hebrew: "שורה שניה",
      hebrewDoubleClickListener: doubleClickListenerSecond,
      doubleClickHintSurfaceType: DoubleClickHintSurfaceType.STEINSALTZ,
    });

    expect(queryOrNull(rootFirst, ".double-click-hint-overlay")).not.toBeNull();
    expect(queryOrNull(rootSecond, ".double-click-hint-overlay")).toBeNull();
  });

  test("external double-tap event on same surface type dismisses the active visual hint", () => {
    const doubleClickListener = jest.fn();
    const root = renderRow({
      hebrew: "מאימתי קורין את שמע",
      hebrewDoubleClickListener: doubleClickListener,
      doubleClickHintSurfaceType: DoubleClickHintSurfaceType.STEINSALTZ,
    });

    expect(queryOrNull(root, ".double-click-hint-overlay")).not.toBeNull();

    act(() => {
      recordDoubleClickInteraction(DoubleClickHintSurfaceType.STEINSALTZ);
    });

    expect(queryOrNull(root, ".double-click-hint-overlay")).toBeNull();
  });
});
