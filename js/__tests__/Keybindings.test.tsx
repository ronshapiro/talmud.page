/**
 * Keyboard navigation, driven through Mousetrap the way a real key press would be.
 *
 * Two defects surfaced while writing these tests, and both are pinned below rather than worked
 * around silently. See "Observations" in FrontendTestingPlan.md.
 *
 *  1. The hidden measuring host renders into `#results` alongside the real page, and
 *     `useScrollTo("#results .table-row")` matches its rows too. The first several `j` presses
 *     therefore walk through invisible rows with no visible effect.
 *  2. `Keybindings` assigns `context.selectedView` in an effect, which runs *after* the render
 *     that reads it, so the highlight trails the internal cursor by one press.
 *
 * Because of (2) the tests distinguish the *internally focused* row — what the next `n`/`o`/`s t`
 * acts on — from the *highlighted* row, which is what the reader sees. `j` also steps through
 * commentary-button rows, not only segment rows, so the helpers below search for a state rather
 * than counting presses.
 */
import * as Mousetrap from "mousetrap";
import {MountedRenderer, mountRenderer} from "./testing/renderer_harness";
import {flush, unmountAll} from "./testing/dom";
import {clearPageEnvironment, installPageEnvironment} from "./testing/page_environment";
import {commentaries, page, resetFixtureCounter, segment} from "./testing/fixtures";

beforeEach(() => {
  installPageEnvironment({book: "Berakhot", path: "/Berakhot/2a"});
  resetFixtureCounter();
});
afterEach(() => {
  unmountAll();
  document.getElementById("main-contents")?.remove();
  clearPageEnvironment();
});

const MAX_PRESSES = 40;

const press = (keys: string) => flush(() => Mousetrap.trigger(keys));

/** The row the reader sees highlighted, or undefined. */
const highlightedRow = (app: MountedRenderer) => (
  app.findOrNull(".keybindingSelectedRow .table-cell.hebrew")?.textContent);
const selectedButton = (app: MountedRenderer) => (
  app.findOrNull(".keybindingSelectedButton")?.textContent);
const commentTexts = (app: MountedRenderer) => (
  app.textsOf(".IndividualComment .table-cell.hebrew"));

/** How many rows of the hidden measuring host sit ahead of the real page in `#results`. */
const hiddenRowCount = () => (
  [...document.querySelectorAll("#results .table-row")]
    .filter(row => row.closest(".hidden-host")).length);

/**
 * Presses `key` until `predicate` holds, failing loudly if it never does.
 *
 * Both the row highlight and the button highlight trail the internal cursor by one press, so
 * tests search for the state they want instead of counting presses.
 */
function pressUntil(key: string, predicate: () => boolean, description: string): void {
  for (let i = 0; i < MAX_PRESSES; i++) {
    if (predicate()) return;
    press(key);
  }
  throw new Error(`Pressing "${key}" ${MAX_PRESSES} times never ${description}`);
}

/** Presses `j` until the given row is the highlighted one. */
function highlightRow(app: MountedRenderer, text: string): void {
  pressUntil("j", () => highlightedRow(app) === text, `highlighted a row reading "${text}"`);
}

/**
 * Puts the internal cursor on the first visible commentary-button row.
 *
 * `n` only finds buttons while the cursor is on the row that contains them, and every `j` clears
 * the button selection, so this counts presses to the target row rather than searching for it.
 */
function focusCommentaryButtonRow(): void {
  const rows = [...document.querySelectorAll("#results .table-row")];
  const index = rows.findIndex(
    row => !row.closest(".hidden-host") && row.classList.contains("show-buttons"));
  if (index === -1) throw new Error("The page has no commentary buttons to focus");
  for (let i = 0; i <= index; i++) press("j");
}

const twoSegments = () => page({
  id: "2a",
  sections: [
    segment({
      ref: "Berakhot 2a:1",
      he: "ראשון",
      en: "first",
      commentary: commentaries({
        Rashi: [{ref: "Rashi 1", he: 'רש"י על הראשון'}],
        Tosafot: [{ref: "Tosafot 1", he: "תוספות על הראשון"}],
      }),
    }),
    segment({
      ref: "Berakhot 2a:2",
      he: "שני",
      en: "second",
      commentary: commentaries({Rashi: [{ref: "Rashi 2", he: 'רש"י על השני'}]}),
    }),
  ],
});

const enableShortcuts = () => { localStorage.keyboardShortcuts = "true"; };

describe("when shortcuts are disabled", () => {
  test("pressing a navigation key does nothing", () => {
    const app = mountRenderer([twoSegments()]);

    for (let i = 0; i < 10; i++) press("j");

    expect(highlightedRow(app)).toBeUndefined();
  });

  test("keys stop responding once the setting is turned off", () => {
    enableShortcuts();
    const app = mountRenderer([twoSegments()]);
    highlightRow(app, "ראשון");

    delete localStorage.keyboardShortcuts;
    press("j"); // this press still lands, and re-renders with the setting off
    const afterUnbinding = highlightedRow(app);
    for (let i = 0; i < 10; i++) press("j");

    expect(highlightedRow(app)).toBe(afterUnbinding);
  });
});

describe("known defects in row navigation", () => {
  test("the hidden measuring host's rows are navigated first", () => {
    enableShortcuts();
    const app = mountRenderer([twoSegments()]);
    expect(hiddenRowCount()).toBeGreaterThan(0);

    press("j");

    // The cursor moved, but onto a row the reader cannot see.
    expect(highlightedRow(app)).toBeUndefined();
  });

  test("several presses are needed before anything is visibly highlighted", () => {
    enableShortcuts();
    const app = mountRenderer([twoSegments()]);

    let presses = 0;
    while (highlightedRow(app) === undefined && presses < MAX_PRESSES) {
      press("j");
      presses++;
    }

    expect(presses).toBeGreaterThan(hiddenRowCount());
  });

  test("the last row can never be highlighted, because the highlight trails the cursor", () => {
    enableShortcuts();
    const app = mountRenderer([twoSegments()]);
    const lastRowText = app.all("#results .table-row").slice(-1)[0].textContent;

    for (let i = 0; i < MAX_PRESSES; i++) press("j");

    expect(app.findOrNull(".keybindingSelectedRow")?.textContent).not.toBe(lastRowText);
  });
});

describe("moving between rows", () => {
  test("j advances the highlight to the next row", () => {
    enableShortcuts();
    const app = mountRenderer([twoSegments()]);
    highlightRow(app, "ראשון");

    press("j");

    expect(highlightedRow(app)).not.toBe("ראשון");
  });

  test("j eventually reaches the second segment", () => {
    enableShortcuts();
    const app = mountRenderer([twoSegments()]);

    highlightRow(app, "שני");

    expect(highlightedRow(app)).toBe("שני");
  });

  test("k walks the highlight back up the page", () => {
    enableShortcuts();
    const app = mountRenderer([twoSegments()]);
    highlightRow(app, "שני");

    pressUntil("k", () => highlightedRow(app) === "ראשון", "walked back to the first segment");

    expect(highlightedRow(app)).toBe("ראשון");
  });

  test("only one row is highlighted at a time", () => {
    enableShortcuts();
    const app = mountRenderer([twoSegments()]);
    highlightRow(app, "ראשון");

    expect(app.all(".keybindingSelectedRow")).toHaveLength(1);
  });
});

describe("choosing a commentary with the keyboard", () => {
  // These assert through `o`, which acts on the internal cursor, rather than through the
  // `.keybindingSelectedButton` class, which trails it by one press (see the defect above).
  test("n selects the row's first commentary", () => {
    enableShortcuts();
    const app = mountRenderer([twoSegments()]);
    focusCommentaryButtonRow();

    press("n");
    press("o");

    expect(commentTexts(app)).toEqual(['רש"י על הראשון']);
  });

  test("n again moves on to the second commentary", () => {
    enableShortcuts();
    const app = mountRenderer([twoSegments()]);
    focusCommentaryButtonRow();

    press("n");
    press("n");
    press("o");

    expect(commentTexts(app)).toEqual(["תוספות על הראשון"]);
  });

  test("p moves back to the previous commentary", () => {
    enableShortcuts();
    const app = mountRenderer([twoSegments()]);
    focusCommentaryButtonRow();

    press("n");
    press("n");
    press("p");
    press("o");

    expect(commentTexts(app)).toEqual(['רש"י על הראשון']);
  });

  test("opening a commentary does not leave o able to close it again", () => {
    // Another consequence of the trailing cursor: opening a commentary inserts its rows and its
    // close button, so the button list the cursor was pointing into has changed underneath it and
    // the second press no longer lands on the button that was opened.
    enableShortcuts();
    const app = mountRenderer([twoSegments()]);
    focusCommentaryButtonRow();
    press("n");
    press("o");
    expect(commentTexts(app)).toHaveLength(1);

    press("o");

    expect(commentTexts(app)).toEqual(['רש"י על הראשון']);
  });

  test("o does nothing when no commentary is selected", () => {
    enableShortcuts();
    const app = mountRenderer([twoSegments()]);
    highlightRow(app, "ראשון");

    press("o");

    expect(commentTexts(app)).toEqual([]);
  });

  test("the button highlight trails the cursor, as the row highlight does", () => {
    enableShortcuts();
    const app = mountRenderer([twoSegments()]);
    focusCommentaryButtonRow();

    press("n");

    // The cursor is on the first button, but nothing is marked as selected yet.
    expect(selectedButton(app)).toBeUndefined();
  });

  test("moving to another row clears the button selection", () => {
    enableShortcuts();
    const app = mountRenderer([twoSegments()]);
    focusCommentaryButtonRow();
    press("n");
    press("n"); // a second press lets the first one's highlight land
    expect(selectedButton(app)).toBeDefined();

    pressUntil("j", () => selectedButton(app) === undefined, "cleared the button selection");

    expect(selectedButton(app)).toBeUndefined();
  });
});

describe("expanding text from the keyboard", () => {
  test("'s t' triggers the hebrew double-click action on the focused row", () => {
    enableShortcuts();
    localStorage.translationOption = "both";
    const app = mountRenderer([page({
      id: "2a",
      sections: [segment({
        ref: "Berakhot 2a:1",
        he: "מאימתי",
        en: "From when",
        commentary: commentaries({
          Steinsaltz: [{ref: "Steinsaltz 1", he: "שטיינזלץ", en: "steinsaltz english"}],
        }),
      })],
    })], {isTalmud: true});

    // Step onto the gemara row, which is the one before the highlight shows it.
    for (let i = 0; i <= hiddenRowCount(); i++) press("j");
    press("s t");

    expect(commentTexts(app)).toEqual(["שטיינזלץ"]);
  });
});
