import {
  darkModePreference,
  debugSelectionPreference,
  disablePrecachingPreference,
  expandEnglishByDefaultPreference,
  hideGemaraTranslationByDefaultPreference,
  ignoreLocalCachePreference,
  isSiteLanguageHebrew,
  keyboardShortcutsPreference,
  languageOptionPreference,
  layoutOptionPreference,
  offlineModePreference,
  preferredVersionPreference,
  rsiReviewKeyPreference,
  setSiteLanguage,
  showAlternateVersionsPreference,
  showPageMetadataPreference,
  showTranslationButtonPreference,
  siteLanguage,
  SiteLanguage,
  translationOptionPreference,
  wrapTranslationsPreference,
} from "../settings";

beforeEach(() => localStorage.clear());

describe("siteLanguage", () => {
  test("defaults to English when unset", () => {
    expect(siteLanguage()).toBe(SiteLanguage.English);
  });

  test("defaults to English for any unrecognized value", () => {
    localStorage.languageOption = "not a real option";

    expect(siteLanguage()).toBe(SiteLanguage.English);
  });

  test("reads Hebrew and Mix", () => {
    localStorage.languageOption = "hebrew";
    expect(siteLanguage()).toBe(SiteLanguage.Hebrew);

    localStorage.languageOption = "mix";
    expect(siteLanguage()).toBe(SiteLanguage.Mix);
  });
});

describe("setSiteLanguage", () => {
  test("round trips through localStorage", () => {
    setSiteLanguage(SiteLanguage.Hebrew);

    expect(localStorage.languageOption).toBe("hebrew");
    expect(siteLanguage()).toBe(SiteLanguage.Hebrew);
  });
});

describe("isSiteLanguageHebrew", () => {
  test("is false when unset", () => {
    expect(isSiteLanguageHebrew()).toBe(false);
  });

  test("is false for Mix, same as every other call site that reads this setting", () => {
    localStorage.languageOption = "mix";

    expect(isSiteLanguageHebrew()).toBe(false);
  });

  test("is true only for Hebrew", () => {
    localStorage.languageOption = "hebrew";

    expect(isSiteLanguageHebrew()).toBe(true);
  });
});

describe("languageOptionPreference", () => {
  test("is undefined until a choice has been made, unlike siteLanguage()", () => {
    // This is the distinction Preferences.tsx depends on: siteLanguage() defaults to English, so
    // it can't be used to decide whether the "English" radio should render checked before the
    // user has ever chosen a language. The raw preference must stay undefined.
    expect(languageOptionPreference.get()).toBeUndefined();
    expect(siteLanguage()).toBe(SiteLanguage.English);
  });

  test("reflects what setSiteLanguage wrote", () => {
    setSiteLanguage(SiteLanguage.Mix);

    expect(languageOptionPreference.get()).toBe(SiteLanguage.Mix);
  });
});

describe("preference-backed settings", () => {
  // Each [accessor, localStorage key, sample value] tuple. Table-driven so a typo'd key string
  // (the main way this kind of wrapper breaks) fails loudly rather than silently reading/writing
  // the wrong setting.
  const cases: [{get: () => string | undefined, set: (value: any) => void}, string, string][] = [
    [translationOptionPreference, "translationOption", "both"],
    [layoutOptionPreference, "layoutOption", "compact"],
    [showTranslationButtonPreference, "showTranslationButton", "yes"],
    [wrapTranslationsPreference, "wrapTranslations", "false"],
    [expandEnglishByDefaultPreference, "expandEnglishByDefault", "true"],
    [hideGemaraTranslationByDefaultPreference, "hideGemaraTranslationByDefault", "true"],
    [showPageMetadataPreference, "showPageMetadata", "true"],
    [showAlternateVersionsPreference, "showAlternateVersions", "true"],
    [offlineModePreference, "offlineMode", "true"],
    [keyboardShortcutsPreference, "keyboardShortcuts", "true"],
    [debugSelectionPreference, "debugSelection", "true"],
    [ignoreLocalCachePreference, "ignoreLocalCache", "true"],
    [disablePrecachingPreference, "disablePrecaching", "true"],
    [darkModePreference, "darkMode", "gray"],
    [rsiReviewKeyPreference, "rsiReviewKey", "secret123"],
  ];

  test.each(cases)("%#: is undefined when unset, and round trips through its own key", (
    accessor, key, sampleValue,
  ) => {
    expect(accessor.get()).toBeUndefined();

    accessor.set(sampleValue);

    expect(localStorage[key]).toBe(sampleValue);
    expect(accessor.get()).toBe(sampleValue);
  });
});

describe("preferredVersionPreference", () => {
  test("is keyed per resource type", () => {
    preferredVersionPreference("Talmud").set("Koren");
    preferredVersionPreference("Tanakh").set("default");

    expect(preferredVersionPreference("Talmud").get()).toBe("Koren");
    expect(preferredVersionPreference("Tanakh").get()).toBe("default");
    expect(localStorage.preferredVersion_Talmud).toBe("Koren");
    expect(localStorage.preferredVersion_Tanakh).toBe("default");
  });
});
