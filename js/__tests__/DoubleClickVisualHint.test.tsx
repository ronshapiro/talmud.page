import * as React from "react";
import {act} from "react-dom/test-utils";
import TableRow from "../TableRow";
import {
  DoubleClickHintSurfaceType,
  DoubleClickVisualHint,
  claimDoubleClickVisualHint,
  recordDoubleClickInteraction,
  resetDoubleClickVisualHintState,
  shouldDisplayDoubleClickVisualHint,
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
    // Independent surface type is unaffected:
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

  test("claimDoubleClickVisualHint claims once per session and writes to localStorage", () => {
    const currentTimestamp = 1000000000000;

    const firstClaimSuccess = claimDoubleClickVisualHint(
      DoubleClickHintSurfaceType.STEINSALTZ,
      currentTimestamp,
    );
    expect(firstClaimSuccess).toBe(true);
    expect(
      localStorage.getItem(`doubleClickHint.lastDisplayed.${DoubleClickHintSurfaceType.STEINSALTZ}`),
    ).toBe(currentTimestamp.toString());

    // Subsequent claim in same session fails:
    const secondClaimSuccess = claimDoubleClickVisualHint(
      DoubleClickHintSurfaceType.STEINSALTZ,
      currentTimestamp + 100,
    );
    expect(secondClaimSuccess).toBe(false);

    // Other surface type remains claimable independently:
    const otherSurfaceClaimSuccess = claimDoubleClickVisualHint(
      DoubleClickHintSurfaceType.RASHI_EXPLANATION,
      currentTimestamp,
    );
    expect(otherSurfaceClaimSuccess).toBe(true);
  });
});

describe("DoubleClickVisualHint component", () => {
  test("renders dot, core, ripple, and aria attributes", () => {
    const root = mount(
      <DoubleClickVisualHint surfaceType={DoubleClickHintSurfaceType.STEINSALTZ} />,
    );
    const container = query(root, ".double-click-hint-container");

    expect(container).not.toBeNull();
    expect(container.getAttribute("title")).toBe("Double click to open");
    expect(container.getAttribute("aria-label")).toBe("Double click to open");
    expect(container.getAttribute("data-surface-type")).toBe("steinsaltz");
    expect(queryOrNull(root, ".double-click-hint-dot")).not.toBeNull();
    expect(queryOrNull(root, ".double-click-hint-core")).not.toBeNull();
    expect(queryOrNull(root, ".double-click-hint-ripple")).not.toBeNull();
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

  test("renders visual hint on double-clickable row and dismisses on double-click", () => {
    const doubleClickListener = jest.fn();
    const root = renderRow({
      hebrew: "מאימתי קורין את שמע",
      hebrewDoubleClickListener: doubleClickListener,
      doubleClickHintSurfaceType: DoubleClickHintSurfaceType.STEINSALTZ,
    });

    const hintElement = queryOrNull(root, ".double-click-hint-container");
    expect(hintElement).not.toBeNull();

    // Double clicking the row triggers the listener and removes the hint
    doubleClick(query(root, ".table-cell.hebrew"));
    expect(doubleClickListener).toHaveBeenCalledTimes(1);

    expect(queryOrNull(root, ".double-click-hint-container")).toBeNull();
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

    expect(queryOrNull(root, ".double-click-hint-container")).toBeNull();
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

    expect(queryOrNull(root, ".double-click-hint-container")).toBeNull();
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

    expect(queryOrNull(rootFirst, ".double-click-hint-container")).not.toBeNull();
    expect(queryOrNull(rootSecond, ".double-click-hint-container")).toBeNull();
  });

  test("external double-tap event on same surface type dismisses the active visual hint", () => {
    const doubleClickListener = jest.fn();
    const root = renderRow({
      hebrew: "מאימתי קורין את שמע",
      hebrewDoubleClickListener: doubleClickListener,
      doubleClickHintSurfaceType: DoubleClickHintSurfaceType.STEINSALTZ,
    });

    expect(queryOrNull(root, ".double-click-hint-container")).not.toBeNull();

    // User double taps another Steinsaltz element elsewhere:
    act(() => {
      recordDoubleClickInteraction(DoubleClickHintSurfaceType.STEINSALTZ);
    });

    expect(queryOrNull(root, ".double-click-hint-container")).toBeNull();
  });
});
