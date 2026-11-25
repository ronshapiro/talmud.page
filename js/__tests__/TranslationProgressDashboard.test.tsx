import * as React from "react";
import {
  buildSmoothSvgPath,
  TranslationProgressDashboard,
} from "../TranslationProgressDashboard";
import {
  setSiteLanguage,
  SiteLanguage,
  TranslationProgressSortOption,
  translationProgressSortOrderPreference,
} from "../settings";
import {
  MasechetProgress,
  TranslationProgressData,
  TranslationTimelinePoint,
} from "../../precomputed/translation_progress_summary";
import {
  click,
  flush,
  mount,
  query,
  queryAll,
  queryOrNull,
  texts,
  unmountAll,
} from "./testing/dom";
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

function buildZeroCommentMasechet({
  canonicalName,
  hebrewName,
  seder,
  sederHebrew,
  totalPages,
}: {
  canonicalName: string;
  hebrewName: string;
  seder: string;
  sederHebrew: string;
  totalPages: number;
}): MasechetProgress {
  return {
    canonicalName,
    hebrewName,
    seder,
    sederHebrew,
    totalPages,
    completePages: 0,
    partialPages: 0,
    notStartedPages: 0,
    noCommentsPages: totalPages,
    totalComments: 0,
    translatedComments: 0,
    percentCompletePages: 0,
    percentTranslatedComments: 0,
    pages: [],
  };
}

function buildMixedCandidateProgressData(): TranslationProgressData {
  const masechtot: MasechetProgress[] = [
    buildMasechet({
      canonicalName: "Meilah",
      hebrewName: "מעילה",
      seder: "Kodashim",
      sederHebrew: "קדשים",
      totalPages: 41,
      completePages: 0,
    }),
    buildZeroCommentMasechet({
      canonicalName: "Shekalim",
      hebrewName: "שקלים",
      seder: "Moed",
      sederHebrew: "מועד",
      totalPages: 42,
    }),
    buildMasechet({
      canonicalName: "Berakhot",
      hebrewName: "ברכות",
      seder: "Zeraim",
      sederHebrew: "זרעים",
      totalPages: 59,
      completePages: 59,
    }),
    buildZeroCommentMasechet({
      canonicalName: "Tamid",
      hebrewName: "תמיד",
      seder: "Kodashim",
      sederHebrew: "קדשים",
      totalPages: 17,
    }),
  ];

  // Deliberately pass unadjusted summary totals (including Shekalim 42 + Tamid 17)
  // to verify the dashboard excludes zero-comment tractates from summary totals.
  return {
    summary: {
      totalPages: 159,
      completePages: 59,
      partialPages: 0,
      notStartedPages: 41,
      noCommentsPages: 59,
      totalComments: 100,
      translatedComments: 59,
      percentCompletePages: 37.1,
      percentTranslatedComments: 59,
      updatedAt: "2026-11-22T00:00:00.000Z",
    },
    masechtot,
    timeline: [],
  };
}

describe("TranslationProgressDashboard zero-comment tractates", () => {
  test("keeps Tamid and Shekalim visible without a 0% bar and excludes them from totals", () => {
    const container = mount(
      <TranslationProgressDashboard initialData={buildMixedCandidateProgressData()} />,
    );

    expect(renderedTractates(container)).toEqual(["Meilah", "Shekalim", "Berakhot", "Tamid"]);

    const cards = Array.from(container.querySelectorAll(".masechet-card"));
    const tamidCard = cards.find(
      card => card.querySelector(".masechet-english-name")?.textContent === "Tamid",
    )!;
    const shekalimCard = cards.find(
      card => card.querySelector(".masechet-english-name")?.textContent === "Shekalim",
    )!;
    const meilahCard = cards.find(
      card => card.querySelector(".masechet-english-name")?.textContent === "Meilah",
    )!;

    expect(tamidCard.classList.contains("masechet-card-no-comments")).toBe(true);
    expect(tamidCard.querySelector(".masechet-completion-badge")?.textContent).toBe(
      "No Rashi/Tosafot",
    );
    expect(tamidCard.querySelector(".badge-not-started")).toBeNull();
    expect(tamidCard.querySelector(".mini-stacked-progress-bar")).toBeNull();
    expect(tamidCard.querySelector(".masechet-page-counts")?.textContent).toContain(
      "No Rashi/Tosafot comments",
    );

    expect(shekalimCard.classList.contains("masechet-card-no-comments")).toBe(true);
    expect(shekalimCard.querySelector(".masechet-completion-badge")?.textContent).toBe(
      "No Rashi/Tosafot",
    );
    expect(shekalimCard.querySelector(".mini-stacked-progress-bar")).toBeNull();

    expect(meilahCard.classList.contains("masechet-card-no-comments")).toBe(false);
    expect(meilahCard.querySelector(".masechet-completion-badge")?.textContent).toBe("0%");
    expect(meilahCard.querySelector(".mini-stacked-progress-bar")).not.toBeNull();
  });

  test("renders Hebrew badge for zero-comment tractates", () => {
    setSiteLanguage(SiteLanguage.Hebrew);
    const container = mount(
      <TranslationProgressDashboard initialData={buildMixedCandidateProgressData()} />,
    );

    const cards = Array.from(container.querySelectorAll(".masechet-card"));
    const tamidCard = cards.find(
      card => card.querySelector(".masechet-english-name")?.textContent === "Tamid",
    )!;
    expect(tamidCard.querySelector(".masechet-completion-badge")?.textContent).toBe(
      "אין רש״י/תוספות",
    );
  });

  test("sorts zero-comment tractates after candidates under progress sort orders", () => {
    const container = mount(
      <TranslationProgressDashboard initialData={buildMixedCandidateProgressData()} />,
    );

    selectSortOrder(container, "percent_ascending");
    expect(renderedTractates(container)).toEqual(["Meilah", "Berakhot", "Shekalim", "Tamid"]);

    selectSortOrder(container, "percent_descending");
    expect(renderedTractates(container)).toEqual(["Berakhot", "Meilah", "Shekalim", "Tamid"]);

    selectSortOrder(container, "complete_pages_descending");
    expect(renderedTractates(container)).toEqual(["Berakhot", "Meilah", "Shekalim", "Tamid"]);

    selectSortOrder(container, "alphabetical");
    expect(renderedTractates(container)).toEqual(["Berakhot", "Meilah", "Shekalim", "Tamid"]);
  });
});

function buildTimelineProgressData(
  timeline: TranslationTimelinePoint[],
): TranslationProgressData {
  return {
    ...buildProgressData(),
    timeline,
  };
}

describe("TranslationTimelineChart 7-day rolling pace", () => {
  const sampleTimeline: TranslationTimelinePoint[] = [
    {date: "2026-10-10", dailyCount: 700, cumulativeCount: 700},
    {date: "2026-10-11", dailyCount: 1400, cumulativeCount: 2100},
    {date: "2026-10-12", dailyCount: 2100, cumulativeCount: 4200},
    {date: "2026-10-13", dailyCount: 700, cumulativeCount: 4900},
    {date: "2026-10-14", dailyCount: 0, cumulativeCount: 4900},
    {date: "2026-10-15", dailyCount: 1400, cumulativeCount: 6300},
    {date: "2026-10-16", dailyCount: 700, cumulativeCount: 7000},
    {date: "2026-10-17", dailyCount: 7000, cumulativeCount: 14000},
  ];

  test("defaults to smooth 7-day pace graph and allows switching between all 3 modes", () => {
    const container = mount(
      <TranslationProgressDashboard initialData={buildTimelineProgressData(sampleTimeline)} />,
    );

    const toggleButtons = queryAll(container, ".timeline-toggle-button");
    expect(toggleButtons.map(button => button.textContent)).toEqual([
      "7-Day Pace",
      "Daily Pace",
      "Cumulative",
    ]);
    expect(toggleButtons[0].classList.contains("active")).toBe(true);
    expect(toggleButtons[0].getAttribute("aria-pressed")).toBe("true");
    expect(toggleButtons[1].getAttribute("aria-pressed")).toBe("false");
    expect(toggleButtons[2].getAttribute("aria-pressed")).toBe("false");

    // 7-day pace on 2026-10-17: (1400 + 2100 + 700 + 0 + 1400 + 700 + 7000) / 7 = 1900
    expect(query(container, ".live-stat-date").textContent).toBe("Latest 7-day pace");
    expect(query(container, ".live-stat-value").textContent).toBe("1,900 comments/day");

    const sevenDayPath = queryOrNull(container, ".chart-line-path-seven-day");
    expect(sevenDayPath).not.toBeNull();
    expect(sevenDayPath!.getAttribute("d")).toContain(" C ");
    expect(queryOrNull(container, "path[fill='url(#chartGradientSevenDay)']")).not.toBeNull();

    // Switch to Daily Pace
    click(toggleButtons[1]);
    expect(toggleButtons[1].classList.contains("active")).toBe(true);
    expect(toggleButtons[1].getAttribute("aria-pressed")).toBe("true");
    expect(query(container, ".live-stat-date").textContent).toBe("Latest day");
    expect(query(container, ".live-stat-value").textContent).toBe("+7,000 comments");

    const dailyPath = queryOrNull(container, ".chart-line-path-daily");
    expect(dailyPath).not.toBeNull();
    expect(dailyPath!.getAttribute("d")).not.toContain(" C ");
    expect(dailyPath!.getAttribute("d")).toContain(" L ");

    // Switch to Cumulative
    click(toggleButtons[2]);
    expect(toggleButtons[2].classList.contains("active")).toBe(true);
    expect(toggleButtons[2].getAttribute("aria-pressed")).toBe("true");
    expect(query(container, ".live-stat-date").textContent).toBe("Current total");
    expect(query(container, ".live-stat-value").textContent).toBe("14,000 comments");

    const cumulativePath = queryOrNull(container, ".chart-line-path");
    expect(cumulativePath).not.toBeNull();
    expect(queryOrNull(container, "path[fill='url(#chartGradientCumulative)']")).not.toBeNull();
  });

  test("updates live stat readout when hovering across points in 7-day mode", () => {
    const container = mount(
      <TranslationProgressDashboard initialData={buildTimelineProgressData(sampleTimeline)} />,
    );
    const svgElement = query(container, ".timeline-svg");
    svgElement.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 840,
      height: 260,
      right: 840,
      bottom: 260,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    // Hover at the rightmost plot position (index 7 -> 2026-10-17 -> 1,900/day)
    flush(() => {
      svgElement.dispatchEvent(new MouseEvent("mousemove", {bubbles: true, clientX: 815}));
    });
    expect(query(container, ".live-stat-date").textContent).toBe("Oct 17, 2026");
    expect(query(container, ".live-stat-value").textContent).toBe(
      "1,900 comments/day (7-day avg)",
    );

    flush(() => {
      svgElement.dispatchEvent(new MouseEvent("mouseout", {bubbles: true}));
    });
    expect(query(container, ".live-stat-date").textContent).toBe("Latest 7-day pace");

    const headerRow = query(container, ".timeline-header-row");
    const statRow = query(container, ".timeline-stat-row");
    expect(queryOrNull(headerRow, ".timeline-live-stat")).toBeNull();
    expect(queryOrNull(statRow, ".timeline-live-stat")).not.toBeNull();
  });

  test("renders Hebrew toggle labels and single-point timeline cleanly", () => {
    setSiteLanguage(SiteLanguage.Hebrew);
    const singlePointTimeline: TranslationTimelinePoint[] = [
      {date: "2026-11-01", dailyCount: 700, cumulativeCount: 700},
    ];
    const container = mount(
      <TranslationProgressDashboard initialData={buildTimelineProgressData(singlePointTimeline)} />,
    );

    const toggleButtons = queryAll(container, ".timeline-toggle-button");
    expect(toggleButtons.map(button => button.textContent)).toEqual([
      "ממוצע 7 ימים",
      "יומי",
      "מצטבר",
    ]);
    expect(query(container, ".live-stat-date").textContent).toBe("קצב 7 ימים אחרון");
    expect(query(container, ".live-stat-value").textContent).toBe("100 פירושים ליום");

    const pathData = query(container, ".chart-line-path-seven-day").getAttribute("d")!;
    expect(pathData).not.toContain("NaN");
    for (const axisLabel of texts(container, ".chart-axis-text")) {
      expect(axisLabel).not.toContain("NaN");
    }
  });

  test("buildSmoothSvgPath preserves monotonicity without overshooting extrema", () => {
    const pathData = buildSmoothSvgPath([
      {x: 0, y: 200},
      {x: 100, y: 50},
      {x: 200, y: 200},
      {x: 300, y: 200},
    ]);

    expect(pathData).toContain(" C ");
    const coordinatePairs = pathData.match(/-?\d+\.\d+\s+-?\d+\.\d+/g) ?? [];
    for (const pair of coordinatePairs) {
      const yValue = Number(pair.split(/\s+/)[1]);
      expect(yValue).toBeGreaterThanOrEqual(50);
      expect(yValue).toBeLessThanOrEqual(200);
    }
  });
});
