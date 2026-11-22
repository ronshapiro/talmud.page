import * as React from "react";
import {TranslationProgressDashboard} from "../TranslationProgressDashboard";
import {
  setSiteLanguage,
  SiteLanguage,
  TranslationProgressSortOption,
  translationProgressSortOrderPreference,
} from "../settings";
import {
  MasechetProgress,
  TranslationProgressData,
} from "../../precomputed/translation_progress_data";
import {flush, mount, query, texts, unmountAll} from "./testing/dom";
import {clearPageEnvironment, installPageEnvironment} from "./testing/page_environment";

function buildMasechet({
  canonicalName,
  hebrewName,
  seder,
  sederHebrew,
  totalPages,
  completePages,
}: {
  canonicalName: string;
  hebrewName: string;
  seder: string;
  sederHebrew: string;
  totalPages: number;
  completePages: number;
}): MasechetProgress {
  const notStartedPages = totalPages - completePages;
  const percentCompletePages = Math.round((completePages / totalPages) * 1000) / 10;
  return {
    canonicalName,
    hebrewName,
    seder,
    sederHebrew,
    totalPages,
    completePages,
    partialPages: 0,
    notStartedPages,
    noCommentsPages: 0,
    totalComments: totalPages,
    translatedComments: completePages,
    percentCompletePages,
    percentTranslatedComments: percentCompletePages,
    pages: [],
  };
}

function buildProgressData(): TranslationProgressData {
  // Chosen so each of the 6 sort options yields a distinct tractate ordering:
  // traditional: [Shabbat, Pesachim, Berakhot, Eruvin]
  // percent_descending (80, 60, 20, 10): [Berakhot, Eruvin, Shabbat, Pesachim]
  // percent_ascending (10, 20, 60, 80): [Pesachim, Shabbat, Eruvin, Berakhot]
  // complete_pages_descending (60, 48, 30, 12): [Eruvin, Berakhot, Shabbat, Pesachim]
  // total_pages_descending (150, 120, 100, 60): [Shabbat, Pesachim, Eruvin, Berakhot]
  // alphabetical: [Berakhot, Eruvin, Pesachim, Shabbat]
  const masechtot: MasechetProgress[] = [
    buildMasechet({
      canonicalName: "Shabbat",
      hebrewName: "שבת",
      seder: "Moed",
      sederHebrew: "מועד",
      totalPages: 150,
      completePages: 30,
    }),
    buildMasechet({
      canonicalName: "Pesachim",
      hebrewName: "פסחים",
      seder: "Moed",
      sederHebrew: "מועד",
      totalPages: 120,
      completePages: 12,
    }),
    buildMasechet({
      canonicalName: "Berakhot",
      hebrewName: "ברכות",
      seder: "Zeraim",
      sederHebrew: "זרעים",
      totalPages: 60,
      completePages: 48,
    }),
    buildMasechet({
      canonicalName: "Eruvin",
      hebrewName: "עירובין",
      seder: "Moed",
      sederHebrew: "מועד",
      totalPages: 100,
      completePages: 60,
    }),
  ];

  return {
    summary: {
      totalPages: 430,
      completePages: 150,
      partialPages: 0,
      notStartedPages: 280,
      noCommentsPages: 0,
      totalComments: 430,
      translatedComments: 150,
      percentCompletePages: 34.9,
      percentTranslatedComments: 34.9,
      updatedAt: "2026-11-22T00:00:00.000Z",
    },
    masechtot,
    timeline: [],
  };
}

function selectSortOrder(container: HTMLElement, value: string): HTMLSelectElement {
  const selectElement = query(container, ".sort-select") as HTMLSelectElement;
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value",
  )!.set!;
  valueSetter.call(selectElement, value);
  flush(() => {
    selectElement.dispatchEvent(new Event("change", {bubbles: true}));
  });
  return selectElement;
}

function renderedTractates(container: HTMLElement): string[] {
  return texts(container, ".masechet-english-name");
}

beforeEach(() => {
  installPageEnvironment({path: "/translation-progress"});
});

afterEach(() => {
  unmountAll();
  clearPageEnvironment();
});

describe("TranslationProgressDashboard sort order persistence", () => {
  test("defaults to traditional order when no preference is saved", () => {
    const container = mount(<TranslationProgressDashboard initialData={buildProgressData()} />);
    const selectElement = query(container, ".sort-select") as HTMLSelectElement;

    expect(selectElement.value).toBe("traditional");
    expect(renderedTractates(container)).toEqual(["Shabbat", "Pesachim", "Berakhot", "Eruvin"]);
    expect(translationProgressSortOrderPreference.get()).toBeUndefined();
  });

  test("saves chosen sort order and restores it on subsequent mounts", () => {
    const firstContainer = mount(
      <TranslationProgressDashboard initialData={buildProgressData()} />,
    );
    const firstSelect = selectSortOrder(firstContainer, "percent_descending");

    expect(firstSelect.value).toBe("percent_descending");
    expect(translationProgressSortOrderPreference.get()).toBe("percent_descending");
    expect(renderedTractates(firstContainer)).toEqual([
      "Berakhot",
      "Eruvin",
      "Shabbat",
      "Pesachim",
    ]);

    unmountAll();

    const reloadedContainer = mount(
      <TranslationProgressDashboard initialData={buildProgressData()} />,
    );
    const reloadedSelect = query(reloadedContainer, ".sort-select") as HTMLSelectElement;

    expect(reloadedSelect.value).toBe("percent_descending");
    expect(renderedTractates(reloadedContainer)).toEqual([
      "Berakhot",
      "Eruvin",
      "Shabbat",
      "Pesachim",
    ]);

    selectSortOrder(reloadedContainer, "traditional");
    expect(translationProgressSortOrderPreference.get()).toBe("traditional");

    unmountAll();

    const resetContainer = mount(
      <TranslationProgressDashboard initialData={buildProgressData()} />,
    );
    expect((query(resetContainer, ".sort-select") as HTMLSelectElement).value).toBe("traditional");
    expect(renderedTractates(resetContainer)).toEqual([
      "Shabbat",
      "Pesachim",
      "Berakhot",
      "Eruvin",
    ]);
  });

  test.each<[TranslationProgressSortOption, string[]]>([
    ["traditional", ["Shabbat", "Pesachim", "Berakhot", "Eruvin"]],
    ["percent_descending", ["Berakhot", "Eruvin", "Shabbat", "Pesachim"]],
    ["percent_ascending", ["Pesachim", "Shabbat", "Eruvin", "Berakhot"]],
    ["complete_pages_descending", ["Eruvin", "Berakhot", "Shabbat", "Pesachim"]],
    ["total_pages_descending", ["Shabbat", "Pesachim", "Eruvin", "Berakhot"]],
    ["alphabetical", ["Berakhot", "Eruvin", "Pesachim", "Shabbat"]],
  ])("restores %s sort order from localStorage on initial render", (sortOption, expectedOrder) => {
    translationProgressSortOrderPreference.set(sortOption);

    const container = mount(<TranslationProgressDashboard initialData={buildProgressData()} />);
    const selectElement = query(container, ".sort-select") as HTMLSelectElement;

    expect(selectElement.value).toBe(sortOption);
    expect(renderedTractates(container)).toEqual(expectedOrder);
  });

  test("falls back to traditional order if localStorage holds an unrecognized value", () => {
    localStorage.translationProgressSortOrder = "invalid_sort_order";

    const container = mount(<TranslationProgressDashboard initialData={buildProgressData()} />);
    const selectElement = query(container, ".sort-select") as HTMLSelectElement;

    expect(selectElement.value).toBe("traditional");
    expect(renderedTractates(container)).toEqual(["Shabbat", "Pesachim", "Berakhot", "Eruvin"]);
  });

  test("renders Hebrew option labels while preserving remembered sort order", () => {
    setSiteLanguage(SiteLanguage.Hebrew);
    translationProgressSortOrderPreference.set("alphabetical");

    const container = mount(<TranslationProgressDashboard initialData={buildProgressData()} />);
    const selectElement = query(container, ".sort-select") as HTMLSelectElement;

    expect(selectElement.value).toBe("alphabetical");
    expect(selectElement.selectedOptions[0].textContent).toBe("סדר א״ב (אנגלית)");
    expect(renderedTractates(container)).toEqual(["Berakhot", "Eruvin", "Pesachim", "Shabbat"]);
  });
});
