/**
 * Typed getters (and setters, where a setting is written from more than one place) for
 * `localStorage`-backed settings that would otherwise be read directly, all over the code base, as
 * ad hoc string comparisons (testability suggestion #3 in FrontendTestabilitySuggestions.md).
 *
 * These still read/write `localStorage` directly rather than through React state: every write to
 * a preference already goes through `Preferences`' `rerender()`, which forces a full re-render of
 * the tree from `Root` down (see js/Root.tsx), so there is no separate state to keep in sync here.
 *
 * `Preferences.tsx`'s `PreferenceSection` renders every one of these as a radio-button group, and
 * reads/writes them through the `get`/`set` pair below rather than a raw `localStorage` key name,
 * so every section goes through the same typed path — there's no "one setting is typed, the rest
 * are raw strings" split.
 */

export interface Preference<T extends string> {
  get: () => T | undefined;
  set: (value: T) => void;
}

/** A raw `get`/`set` pair for one `localStorage` key, typed to that setting's known values. */
function preference<T extends string>(key: string): Preference<T> {
  return {
    get: (): T | undefined => localStorage[key] as T | undefined,
    set: (value: T): void => { localStorage[key] = value; },
  };
}

/**
 * The site's display-language preference (`Preferences.tsx`'s "Display Language" section, stored
 * under `languageOption`). `Mix` means "can read Hebrew, but sometimes wants English" — nothing
 * in the code base currently branches on it separately from `English`.
 */
export enum SiteLanguage {
  Hebrew = "hebrew",
  Mix = "mix",
  English = "english",
}

/**
 * The raw preference, undefined until the user has chosen one -- used by `Preferences.tsx` to
 * know which radio (if any) is currently selected. Everywhere else wants `siteLanguage()` below,
 * which applies the `English` default.
 */
export const languageOptionPreference = preference<SiteLanguage>("languageOption");

/** Anything other than `hebrew`/`mix` — including unset — defaults to `English`. */
export function siteLanguage(): SiteLanguage {
  const value = languageOptionPreference.get();
  return (value === SiteLanguage.Hebrew || value === SiteLanguage.Mix)
    ? value
    : SiteLanguage.English;
}

export function setSiteLanguage(language: SiteLanguage): void {
  languageOptionPreference.set(language);
}

/**
 * Whether the site's UI should currently render in Hebrew. This is what almost every call site
 * actually wants: `Mix` reads as English here too, same as everywhere else in the code base.
 */
export function isSiteLanguageHebrew(): boolean {
  return siteLanguage() === SiteLanguage.Hebrew;
}

/** How much of the Hebrew/English text is shown at once, and whether it's expandable. */
export type TranslationOption = "english-side-by-side" | "both" | "just-hebrew";
export const translationOptionPreference = preference<TranslationOption>("translationOption");

/** Whether merged (Sugya) segments are combined until double-tap. */
export type LayoutOption = "by-segment" | "compact";
export const layoutOptionPreference = preference<LayoutOption>("layoutOption");

/** Whether the standalone "Translation"/Steinsaltz commentary button is shown at all. */
export type YesNo = "yes" | "no";
export const showTranslationButtonPreference = preference<YesNo>("showTranslationButton");

/** The shape shared by every plain on/off preference below. */
export type TrueFalse = "true" | "false";
export const wrapTranslationsPreference = preference<TrueFalse>("wrapTranslations");
export const expandEnglishByDefaultPreference = preference<TrueFalse>("expandEnglishByDefault");
export const hideGemaraTranslationByDefaultPreference = (
  preference<TrueFalse>("hideGemaraTranslationByDefault"));
export const showPageMetadataPreference = preference<TrueFalse>("showPageMetadata");
export const showAlternateVersionsPreference = preference<TrueFalse>("showAlternateVersions");
export const offlineModePreference = preference<TrueFalse>("offlineMode");
export const keyboardShortcutsPreference = preference<TrueFalse>("keyboardShortcuts");
export const debugSelectionPreference = preference<TrueFalse>("debugSelection");
export const ignoreLocalCachePreference = preference<TrueFalse>("ignoreLocalCache");
export const disablePrecachingPreference = preference<TrueFalse>("disablePrecaching");

/**
 * `"true"` (Dark) / `"gray"` (Gray) / `"false"` (Light), or a custom theme's name (see
 * `CustomThemes.ts`) — open-ended, so this is only the raw accessor `Preferences.tsx`'s
 * "Display" section needs. `ThemeEditor.tsx`, `CustomThemes.ts`, and the snackbar dark-mode
 * checks read and roll this back with more entangled logic (live preview, cancel-to-previous);
 * that's a separate, more involved pass.
 */
export const darkModePreference = preference<string>("darkMode");

/** Keyed per resource type (e.g. `"Talmud"`, `"Tanakh"`) — the values come from server data. */
export function preferredVersionPreference(resourceType: string): Preference<string> {
  return preference<string>(`preferredVersion_${resourceType}`);
}
