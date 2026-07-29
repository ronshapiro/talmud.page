import * as React from "react";
import {Preferences} from "../Preferences";
import {saveCustomTheme} from "../CustomThemes";
import {TestConfiguration, TestContext} from "./testing/configuration";
import {
  click,
  mount,
  query,
  queryAll,
  queryOrNull,
  texts,
  unmountAll,
} from "./testing/dom";
import {clearPageEnvironment, installPageEnvironment} from "./testing/page_environment";

beforeEach(() => installPageEnvironment());
afterEach(() => {
  unmountAll();
  clearPageEnvironment();
});

function render(overrides: Partial<TestConfiguration> = {}): {
  container: HTMLElement, rerenders: () => number,
} {
  let rerenders = 0;
  const container = mount(
    <TestContext overrides={overrides}>
      <Preferences rerender={() => { rerenders++; }} />
    </TestContext>,
  );
  return {container, rerenders: () => rerenders};
}

function open(overrides: Partial<TestConfiguration> = {}): {
  container: HTMLElement, rerenders: () => number,
} {
  const result = render(overrides);
  click(query(result.container, "#showSettings"));
  return result;
}

/** The labels of the radio options on the currently visible slide. */
const optionLabels = (container: HTMLElement) => texts(container, ".mdl-radio__label");
const radios = (container: HTMLElement) => (
  queryAll(container, "input[type=radio]") as HTMLInputElement[]);

describe("showing and hiding", () => {
  test("the settings panel is closed initially", () => {
    const {container} = render();

    expect(queryOrNull(container, "#preferences-container")).toBeNull();
    expect(queryOrNull(container, "#showSettings")).not.toBeNull();
  });

  test("the settings button opens the panel", () => {
    const {container} = open();

    expect(queryOrNull(container, "#preferences-container")).not.toBeNull();
  });

  test("the settings button closes it again", () => {
    const {container} = open();

    click(query(container, "#showSettings"));

    expect(queryOrNull(container, "#preferences-container")).toBeNull();
  });

  test("it can be opened programmatically, as the snackbar nudge does", () => {
    const {container} = render();

    (window as any).showPreferences();

    expect(queryOrNull(container, "#preferences-container")).not.toBeNull();
  });
});

describe("the display language section", () => {
  test("opens on the display language options by default", () => {
    const {container} = open();

    expect(optionLabels(container)).toEqual([
      "עברית (לא  רוצה אנגלית אף פעם)",
      "Mix: I can do Hebrew, but sometimes want English",
      "English",
    ]);
  });

  test("the stored choice is the checked one", () => {
    localStorage.languageOption = "english";
    const {container} = open();

    const checked = radios(container).filter(x => x.checked);
    expect(checked.map(x => x.value)).toEqual(["english"]);
  });

  test("nothing is checked when no choice has been made", () => {
    const {container} = open();

    expect(radios(container).filter(x => x.checked)).toHaveLength(0);
  });

  test("choosing an option persists it and asks the page to re-render", () => {
    const {container, rerenders} = open();
    const before = rerenders();

    const english = radios(container).find(x => x.value === "english")!;
    english.click();

    expect(localStorage.languageOption).toBe("english");
    expect(rerenders()).toBeGreaterThan(before);
  });

  test("re-choosing the current option does not trigger a re-render", () => {
    localStorage.languageOption = "english";
    const {container, rerenders} = open();
    const before = rerenders();

    radios(container).find(x => x.value === "english")!.click();

    expect(rerenders()).toBe(before);
  });
});

describe("hebrew mode", () => {
  test("section titles and options are shown in hebrew", () => {
    localStorage.languageOption = "hebrew";
    localStorage.preferencesIndex = "1";
    const {container} = open();

    // Layout is the second section in hebrew mode, since the english-only Translation section is
    // filtered out.
    expect(container.textContent).toContain("פריסת הטקסט");
    expect(optionLabels(container)).toContain("ברירת מחדל");
  });

  test("english-only sections are dropped, shifting the ones after them", () => {
    localStorage.preferencesIndex = "1";
    const inEnglish = open();
    expect(inEnglish.container.textContent).toContain("Translation");
    unmountAll();

    localStorage.languageOption = "hebrew";
    const inHebrew = open();

    expect(inHebrew.container.textContent).not.toContain("English (side-by-side)");
  });
});

describe("navigating between sections", () => {
  test("the forward chevron moves to the next section", () => {
    const {container} = open();
    expect(container.textContent).toContain("Display Language");

    click(queryAll(container, "#preferences-container button.mdl-button--icon")[1]);

    expect(container.textContent).toContain("Translation");
  });

  test("the section index is remembered for the next visit", () => {
    const {container} = open();

    click(queryAll(container, "#preferences-container button.mdl-button--icon")[1]);

    expect(localStorage.preferencesIndex).toBe("1");
  });

  test("opening starts at the remembered section", () => {
    localStorage.preferencesIndex = "2";
    const {container} = open();

    expect(container.textContent).toContain("Layout");
  });
});

describe("version preferences", () => {
  test("no version section when the renderer has no alternate versions", () => {
    localStorage.preferencesIndex = "2";
    const {container} = open({versions: () => []});

    expect(container.textContent).not.toContain("Preferred Version");
  });

  test("the version section is inserted when versions exist", () => {
    localStorage.preferencesIndex = "2";
    const {container} = open({
      versions: () => [{hebrew: 'ש"ס וילנא', english: "Vilna Shas"}],
    });

    expect(container.textContent).toContain("Preferred Version");
    expect(optionLabels(container)).toContain("Vilna Shas");
  });

  test("the default version is offered alongside the alternates", () => {
    localStorage.preferencesIndex = "2";
    const {container} = open({
      rendererType: "Talmud",
      versions: () => [{hebrew: 'ש"ס וילנא', english: "Vilna Shas"}],
    });

    expect(optionLabels(container)[0]).toContain("Default");
  });

  test("choosing a version stores it under the renderer's own key", () => {
    localStorage.preferencesIndex = "2";
    const {container} = open({
      rendererType: "Talmud",
      versions: () => [{hebrew: 'ש"ס וילנא', english: "Vilna Shas"}],
    });

    radios(container).find(x => x.value === "Vilna Shas")!.click();

    expect(localStorage.preferredVersion_Talmud).toBe("Vilna Shas");
  });
});

describe("custom themes", () => {
  const openDisplaySection = () => {
    // Display is the fourth section when there are no versions.
    localStorage.preferencesIndex = "3";
    return open({versions: () => []});
  };

  test("the built-in themes are always offered", () => {
    const {container} = openDisplaySection();

    expect(optionLabels(container)).toEqual(
      expect.arrayContaining(["Dark Mode", "Gray Mode", "Light Mode"]));
  });

  test("a saved custom theme appears as another choice", () => {
    saveCustomTheme({name: "Sepia", baseTheme: "gray", overrides: {}});
    const {container} = openDisplaySection();

    expect(optionLabels(container)).toContain("Sepia");
  });

  test("custom themes offer edit and delete, built-ins do not", () => {
    saveCustomTheme({name: "Sepia", baseTheme: "gray", overrides: {}});
    const {container} = openDisplaySection();

    // One edit + one delete for Sepia, plus the "Create new" button.
    expect(texts(container, "#preferences-container .material-icons"))
      .toEqual(expect.arrayContaining(["edit", "delete", "add_circle_outline"]));
  });

  test("deleting a custom theme removes it from the list", () => {
    saveCustomTheme({name: "Sepia", baseTheme: "gray", overrides: {}});
    const {container} = openDisplaySection();

    const deleteButton = queryAll(container, "#preferences-container .material-icons")
      .find(x => x.textContent === "delete")!;
    click(deleteButton.parentElement!);

    expect(optionLabels(container)).not.toContain("Sepia");
  });

  test("the create-new button opens the theme editor", () => {
    const {container} = openDisplaySection();

    const addButton = queryAll(container, "#preferences-container .material-icons")
      .find(x => x.textContent === "add_circle_outline")!;
    click(addButton.parentElement!);

    expect(queryAll(container, "input[type=color]").length).toBeGreaterThan(0);
  });
});
