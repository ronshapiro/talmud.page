import * as React from "react";
import TableRow from "../TableRow";
import {TestContext, testConfiguration} from "./testing/configuration";
import {
  classesOf,
  doubleClick,
  mount,
  query,
  queryAll,
  queryOrNull,
  unmountAll,
} from "./testing/dom";
import {clearPageEnvironment, installPageEnvironment} from "./testing/page_environment";

beforeEach(() => installPageEnvironment());
afterEach(() => {
  unmountAll();
  clearPageEnvironment();
});

function renderRow(
  props: Partial<React.ComponentProps<typeof TableRow>> = {},
  contextOverrides = {},
): HTMLElement {
  return mount(
    <TestContext overrides={contextOverrides}>
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <TableRow classes={[]} {...props} />
    </TestContext>,
  );
}

const hebrewCell = (root: HTMLElement) => query(root, ".table-cell.hebrew");
const englishCell = (root: HTMLElement) => query(root, ".table-cell.english");

describe("cell layout", () => {
  test("renders hebrew and english as separate directional cells", () => {
    const root = renderRow({hebrew: "שלום", english: "hello"});

    expect(hebrewCell(root).getAttribute("dir")).toBe("rtl");
    expect(hebrewCell(root).textContent).toBe("שלום");
    expect(englishCell(root).getAttribute("dir")).toBe("ltr");
    expect(englishCell(root).textContent).toBe("hello");
    expect(classesOf(hebrewCell(root))).not.toContain("fullRow");
    expect(classesOf(englishCell(root))).not.toContain("fullRow");
  });

  test("uses a full row when there is no english", () => {
    const root = renderRow({hebrew: "שלום", english: ""});

    expect(classesOf(hebrewCell(root))).toContain("fullRow");
    expect(queryOrNull(root, ".table-cell.english")).toBeNull();
  });

  test("uses a full row when there is no hebrew", () => {
    const root = renderRow({hebrew: "", english: "hello"});

    expect(queryOrNull(root, ".table-cell.hebrew")).toBeNull();
    expect(classesOf(englishCell(root))).toContain("fullRow");
  });

  test("overrideFullRow keeps two cells even when one side is empty", () => {
    const root = renderRow({hebrew: "שלום", english: "", overrideFullRow: true});

    expect(classesOf(hebrewCell(root))).not.toContain("fullRow");
  });

  test("hebrew-only mode drops the english cell entirely", () => {
    localStorage.languageOption = "hebrew";
    const root = renderRow({hebrew: "שלום", english: "hello"});

    expect(queryOrNull(root, ".table-cell.english")).toBeNull();
    expect(classesOf(hebrewCell(root))).toContain("fullRow");
  });

  test("passes through id, classes, ref and link", () => {
    const root = renderRow({
      hebrew: "שלום",
      id: "my-id",
      classes: ["commentaryRow", "rashi"],
      "sefaria-ref": "Rashi on Berakhot 2a:1",
      link: "https://example.com",
    });

    const row = query(root, ".table-row");
    expect(row.id).toBe("my-id");
    expect(classesOf(row)).toEqual(["table-row", "commentaryRow", "rashi"]);
    expect(row.getAttribute("sefaria-ref")).toBe("Rashi on Berakhot 2a:1");
    expect(row.getAttribute("tp-link")).toBe("https://example.com");
  });
});

describe("english expansion", () => {
  test("english starts line-clamped and expands on double click", () => {
    const root = renderRow({hebrew: "שלום", english: "hello"});
    expect(classesOf(englishCell(root))).toContain("lineClamped");

    doubleClick(englishCell(root));

    expect(classesOf(englishCell(root))).not.toContain("lineClamped");
  });

  test("expandEnglishByDefault starts expanded", () => {
    const root = renderRow({hebrew: "שלום", english: "hello", expandEnglishByDefault: true});

    expect(classesOf(englishCell(root))).not.toContain("lineClamped");
  });

  test("a full-row english cell is always expanded and cannot be collapsed", () => {
    const root = renderRow({english: "hello"});
    expect(classesOf(englishCell(root))).not.toContain("lineClamped");

    doubleClick(englishCell(root));

    expect(classesOf(englishCell(root))).not.toContain("lineClamped");
  });

  test("a full-row jastrow english cell is still collapsible", () => {
    const root = renderRow({english: "hello", classes: ["jastrow"]});

    expect(classesOf(englishCell(root))).toContain("lineClamped");
  });
});

describe("double click listeners", () => {
  test("the hebrew cell listener fires on double click", () => {
    const listener = jest.fn();
    const root = renderRow({
      hebrew: "שלום", english: "hello", hebrewDoubleClickListener: listener,
    });

    doubleClick(hebrewCell(root));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("onUnexpand renders a close button inside the hebrew cell", () => {
    const onUnexpand = jest.fn();
    const root = renderRow({hebrew: "שלום", english: "hello", onUnexpand});

    const closeButton = query(hebrewCell(root), ".material-icons");
    expect(closeButton.textContent).toBe("cancel");
    closeButton.click();

    expect(onUnexpand).toHaveBeenCalledTimes(1);
  });

  test("there is no close button without onUnexpand", () => {
    const root = renderRow({hebrew: "שלום", english: "hello"});

    expect(queryOrNull(hebrewCell(root), ".material-icons")).toBeNull();
  });
});

describe("sanitization", () => {
  test("strips scripts from cell html", () => {
    const root = renderRow({hebrew: 'שלום<script>alert("x")</script>', english: "hello"});

    expect(hebrewCell(root).innerHTML).toBe("שלום");
  });

  test("preserves the custom highlight tag and its attribute", () => {
    // `span-highlight` and `highlight-id` are non-standard and are only kept because they are
    // explicitly allow-listed in TableRow's sanitize config.
    const root = renderRow({
      hebrew: '<span-highlight class="highlighted" highlight-id="7">שלום</span-highlight>',
      english: "hello",
    });

    const highlight = query(hebrewCell(root), "span-highlight");
    expect(highlight.textContent).toBe("שלום");
    expect(highlight.getAttribute("highlight-id")).toBe("7");
    expect(classesOf(highlight)).toEqual(["highlighted"]);
  });

  test("preserves ordinary formatting tags", () => {
    const root = renderRow({hebrew: "<b>שלום</b><br>עולם", english: "hello"});

    expect(hebrewCell(root).innerHTML).toBe("<b>שלום</b><br>עולם");
  });
});

describe("search term highlighting", () => {
  test("wraps matches in the configured color", () => {
    const configuration = testConfiguration({searchQueryRegex: {yellow: "hello"}});
    const root = mount(
      <TestContext configuration={configuration}>
        <TableRow classes={[]} hebrew="שלום" english="say hello now" />
      </TestContext>,
    );

    const found = queryAll(root, "span-search-term");
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toBe("hello");
    expect(classesOf(found[0])).toEqual(["foundTerm", "yellow"]);
  });

  test("does not wrap when no query is set", () => {
    const root = renderRow({hebrew: "שלום", english: "say hello now"});

    expect(queryAll(root, "span-search-term")).toHaveLength(0);
  });
});

describe("highlighting affordance", () => {
  test("segmentIdForHighlighting wraps the row in a swipeable background", () => {
    const root = renderRow({
      hebrew: "שלום", english: "hello", segmentIdForHighlighting: "Berakhot 2a:1",
    });

    expect(queryAll(root, ".animateSwipeableBackground")).toHaveLength(1);
  });

  test("no swipeable background without a highlighting id", () => {
    const root = renderRow({hebrew: "שלום", english: "hello"});

    expect(queryAll(root, ".animateSwipeableBackground")).toHaveLength(0);
  });

  test("the hidden host copy is never made swipeable", () => {
    const root = renderRow(
      {hebrew: "שלום", english: "hello", segmentIdForHighlighting: "Berakhot 2a:1"},
      {isFake: true});

    expect(queryAll(root, ".animateSwipeableBackground")).toHaveLength(0);
  });
});
