# Frontend testability / modularity suggestions

Recorded while writing tests for `js/`. They are ordered by (value to testability) ÷ (risk of the
change). Each notes what it would unlock.

## 1. Give the configuration context a type — done

`ConfigurationContext` is now `createContext<Configuration | undefined>` and `useConfiguration()`
returns `Configuration` (`js/context.ts`). The shape was already accurate in the test-only
`TestConfiguration` (`js/__tests__/testing/configuration.tsx`), so that interface moved to
production code as `Configuration`, and the test harness now imports it instead of hand-maintaining
a duplicate. `Renderer.register`'s object literal and the `HiddenHost` component's `context` prop
are both typed against it, so a future field rename or omission there is a compile error.

The type is honest about the one place production and consumer disagree: both
`expandTranslationOnMergedSectionExpansion` and `expandTranslationOnMergedSegmentExpansion` are
declared (see Observation #9 in `FrontendTestingPlan.md`) rather than "fixed" by picking one
spelling — this was a pure typing change, not a behavior change.

Unlocked: `js/__tests__/renderers.test.tsx` no longer needs the `as any` cast it used to pass the
mismatched-spelling override through `TestContext`.

## 2. Extract the context construction out of `register()` — done

`register()` did five things: build the context, build the hidden-host context variant,
`ReactDOM.render` the tree, attach a window resize handler, and bump the `pageViews` counter that
triggers the feedback form. `buildConfiguration(): Configuration` and
`buildHiddenHostConfiguration(base): Configuration` are now `Renderer` methods (not standalone
functions, since the context literal reads `this.*` throughout) that `register()` calls; no other
change to `register()`'s behavior.

Covered by `Renderer_buildConfiguration.test.ts`, including the collision noted in Observation #8
(Steinsaltz/Translation sharing a className) surfacing immediately in a naive
`commentaryTypesByClassName` bijection check — narrowed to a single unaffected commentary type
rather than worked around.

Unlocked: those tests build a production configuration directly, without touching `pageViews` or
rendering anything.

## 3. Funnel `localStorage` reads through a single module — done, except `darkMode`'s deeper logic

`localStorage.<key>` used to be read directly at render time in ~10 components, and written
through `Preferences.tsx`'s `PreferenceSection` via a raw, untyped `localStorage[key] = value`.
Consequences:
- Every test had to know the exact string keys and their string-y values (`"true"`, `"yes"`,
  `"hebrew"`) — they're stringly-typed and inconsistent (`showTranslationButton === "yes"` but
  `wrapTranslations !== "false"` but `expandEnglishByDefault === "true"`).
- The defaults were expressed as comparison direction (`!== "false"` means "default on") which is
  easy to get backwards and impossible to discover without reading each site.
- `PreferenceSection` writing every setting the same untyped way meant a typed getter added for
  one setting (`languageOption`, done first) either went unused or had to special-case that one
  section, leaving two different patterns side by side.

`js/settings.ts` now covers every setting `Preferences.tsx` exposes: a typed `get`/`set` pair per
`localStorage` key (`translationOptionPreference`, `layoutOptionPreference`,
`showTranslationButtonPreference`, `wrapTranslationsPreference`,
`expandEnglishByDefaultPreference`, `hideGemaraTranslationByDefaultPreference`,
`showPageMetadataPreference`, `showAlternateVersionsPreference`, `offlineModePreference`,
`keyboardShortcutsPreference`, `debugSelectionPreference`, `ignoreLocalCachePreference`,
`disablePrecachingPreference`, `preferredVersionPreference(resourceType)`, `darkModePreference`),
plus `languageOption`'s richer pair: a `SiteLanguage` enum (`Hebrew`/`Mix`/`English`, matching the
three values the "Display Language" section actually writes — collapsing straight to a boolean
would have hidden that `Mix` exists), `siteLanguage(): SiteLanguage` (defaults unset/unrecognized
to `English`), `setSiteLanguage()`, and `isSiteLanguageHebrew()` for the boolean nearly every call
site actually wants (`Mix` reads as English here, same as everywhere else).

`PreferenceSectionParams<T>` is generic and takes a whole `Preference<T>` object (the same `get`/
`set` pair exported from `settings.ts`) instead of a raw `localStorageKeyName` string, and
`Item<T>`'s `value` is `T` rather than a bare `string`. Every `<PreferenceSection>` passes one of
the accessors above directly — one consistent path, not "languageOption is typed, the rest are raw
strings" — and TypeScript checks that every `items` entry's `value` is actually a member of that
setting's type: an earlier draft where each call site instead took separate `get`/`set` functions
and cast the value at the boundary (`value as TranslationOption`) compiled even for a bogus,
made-up option value, since the cast happened before the type could be checked against `items`.
The one unavoidable cast is inside `PreferenceSection` itself, converting the DOM radio input's
native `string` value back to `T` once — safe, since that string can only be one of the `value`s
the component itself rendered.

Writing this surfaced a real bug before it shipped: `siteLanguage()`'s `English` default made the
"English" radio in `Preferences.tsx` render pre-checked even before a user had ever chosen a
language, because the "is this radio checked" comparison needs the *raw* stored value (undefined
until chosen), not the defaulted one. `Preferences.test.tsx`'s existing "nothing is checked when no
choice has been made" test caught it immediately. Fixed by adding `languageOptionPreference` — the
raw, undefaulted accessor `siteLanguage()`/`setSiteLanguage()` are now built on — and wiring
`Preferences.tsx`'s "Display Language" section to that instead. Every other setting was already
using its raw accessor directly, so none of them had this problem.

`darkMode` intentionally still isn't fully migrated: `Preferences.tsx`'s "Display" section uses
`darkModePreference` (a plain raw string, since the value is `"true"`/`"gray"`/`"false"`/a custom
theme's name — open-ended), but `ThemeEditor.tsx`, `CustomThemes.ts`, and the snackbar dark-mode
checks read and roll it back with more entangled logic (live preview while editing, restoring the
previous value on cancel via `removeItem`) that wasn't touched here. `showFeedbackForm` also isn't
a `Preferences.tsx` setting at all — it's a lifecycle string (`"true"`/`"finished"`/`"ignored"`) set
programmatically by `Renderer`/`Feedback.tsx`, not user-selectable, so it was out of scope for this
pass.

No new React state was introduced: every settings write already goes through `Preferences`'
`rerender()`, which forces a full re-render of the tree from `Root` down, so a plain
localStorage-backed accessor is sufficient — there's no separate state to fall out of sync.

Unlocks: mode-matrix tests without global mutation; would let the mode be a prop/context value
later.

## 4. Separate the measurement concern in `TableRow` — done

`shouldTranslationWrap` mixed three things: writing text into the hidden host, measuring heights,
and deciding layout. Only the third was business logic, and it was untestable because the first
two need a real layout engine.

`decideWrapping` is now a pure function in `js/TableRow.tsx`, exported and tested directly in
`TableRow_decideWrapping.test.ts` with made-up heights — no DOM involved. Its actual parameters
turned out more specific than the rough sketch this suggestion originally proposed
(`{hebrewHeight, englishHeight, totalEnglishLines}`): tracing `shouldTranslationWrap` closely
showed it reads the hidden english node's height *twice*, at two different points after two
different rewrites (once right after `calculateLineCount` leaves it holding
`totalEnglishLines` `<br>` tags, once after it's rewritten to `totalEnglishLines - 3`), and those
two heights are not derivable from each other without assuming a constant per-`<br>` line height
that the original code doesn't assume — it re-measures instead. So `decideWrapping` takes both
explicitly: `{hebrewHeight, englishHeightAtFullLineCount, totalEnglishLines,
englishHeightAtReducedLineCount}`. `shouldTranslationWrap` itself is otherwise untouched — same
sequence of writes and reads, just calling `decideWrapping` instead of computing inline.

`calculateLineCountCache` (`js/TableRow.tsx`) is still keyed by a jQuery object used as an object
key, so every node stringifies to `"[object Object]"` and shares one cache entry — left alone,
as before, since it's a separate bug from what this suggestion was about.

Unlocked: real, direct coverage of the line-clamp decision math, including a case worth noting —
`heightRatio` is `Infinity` (not `NaN`) when the hebrew height is nonzero but the english height
is 0, so the "could not measure" fallback only triggers on the true `0/0` case. Not currently
reachable in production (a `<br>`-tag probe height of exactly 0 would need a collapsed layout),
but the distinction is real and now pinned by a test rather than left implicit.

One deliberate, reviewed behavior change (not just an extraction): `shouldWrap` now also requires
`hebrewHeight > 0`. Direct tests on the pure function made a real edge case visible in a way the
inline version never surfaced — a zero hebrew height produced `shouldWrap: true`, but there's no
hebrew to wrap the english around when the hebrew cell has no height. Fixed in `decideWrapping`
and pinned by a test for that exact case.

## 5. The section-merging loop in `Page` wants to be a function — done

`Page` contained a ~50 line loop that mutated the loop variable `i` from inside a nested `while`,
consulted `context.compactLayout()`, `expandMergedRef`, hadran/sugya markers, and emitted
separators. It was the highest-branching logic in the render tree and could only be tested by
rendering and reading the DOM back.

`groupSections(sections, {compactLayout, expandedUuids}) → SectionGroup[]` is now a pure function
in `js/Page.tsx`, returning plain data (`{sections, startIndex, separatorBefore,
separatorAfter}[]`) with `Page` mapping it to JSX (`Segment`s and `<br>` separators). `startIndex`
-- the merged group's position in the array `groupSections` was called with -- is included because
`Page` needs it for both the segment label (`${amudData.id}_section_${startIndex + 1}`) and, on
the last merged section, the `<br>` key; keeping it as returned data rather than recomputed avoids
`Page` having to re-derive an index that already fell out of the merging itself. Same merging
rules as before, no behavior change; `Page.test.tsx`'s "segment merging"/"separators"/"segment
labels" suites cover it unchanged, since they read the DOM and don't know `groupSections` exists.

One thing this made visible without changing: `Page`'s separator `<br>` keys were built from
whatever the shared loop variable `i` happened to be at each of the two call sites (before the
merge, and after it), which are the same number whenever a run merges exactly one section. A
section that is simultaneously a sugya/hadran start *and* marked `lastSegmentOfSection` would hit
both separator branches with an identical index and produce two `<br>` elements with the same
React key. `groupSections`' `separatorBefore`/`separatorAfter`/`startIndex` reproduce this
faithfully rather than incidentally fixing it — worth a look independently of this suggestion, not
folded in here.

Unlocked: `Page_groupSections.test.ts`, exhaustive table-driven tests of merging, hadran/sugya
separators, and the expand/collapse interaction, all without mounting anything.

## 6. `Renderer._applyClientSideDataTransformations` mutates its input

It rewrites `amudData` in place, and is called on every `getAmudim()` — i.e. on every render.
Its correctness depends on being idempotent, and the `steinsaltzRetained` /
`continuallyRewriteSteinsaltzEnglish` flags exist purely to survive re-entry (see the comment at
`js/Renderer.tsx:200`). This is testable as-is (and is being tested), but a pure
`transform(page) → page` would make the idempotency contract enforceable rather than implied.

Unlocks: nothing new for tests; reduces the chance the implied contract silently breaks.

## 7. Implicit globals should be injected or guarded

`gtag` (`js/CommentariesBlock.tsx:283`) and `componentHandler` are bare globals; the theme code
(`js/hooks.ts:18`) hard-requires four DOM nodes to exist and throws if they don't. Tests must
install all of these. A no-op fallback (`window.gtag ?? (() => {})`) or a thin injected
`analytics` module would remove the need, and would also make the app resilient when an ad
blocker eats the gtag script — which is a real production condition today.

Unlocks: leaf-component tests without a full page environment.

## 8. `HiddenHost` couples measurement to a duplicate render

The hidden host renders a second, fake copy of the whole component tree
(`js/Renderer.tsx:32`) whose only purpose is to own two jQuery nodes for measuring. Any test that
mounts a `TableRow` outside the full app must supply a `HiddenHostContext` with objects that
respond to `.html()` and `.height()`. A narrower `MeasurementContext` (just the two nodes, or a
`measure(html) → height` function) would decouple the two.

This coupling also causes a live bug: the hidden host renders into `#results`, so
`Keybindings`' row navigation walks through its invisible rows before reaching the real page. See
Observations #4 in `FrontendTestingPlan.md`.

Unlocks: mid-level component tests without constructing a fake jQuery surface.

## 9. Modals reassign `window` callbacks during render

`CorrectionModal` assigns `window.showCorrectionModal` in the component body
(`js/CorrectionModal.tsx:24`), i.e. as a render side effect, and `CommentEditorModal` does the
same. Two mounted copies silently fight over the global. In tests this means mount order matters
and cleanup must delete the globals.

Unlocks: independent modal tests; removes a real double-mount hazard.

## 10. Module-load side effects force global setup on every test

Importing `js/Renderer.tsx` transitively imports `js/google_drive/singleton.ts`, which at **module
scope** constructs a `DriveClient`, calls `amudMetadata()` (reading `#book-title` from the
document), and opens an IndexedDB connection. Nothing has been rendered or requested yet.

Consequences:
- A test cannot set up the document in `beforeEach`, because imports are hoisted above it. The
  jest `setupFiles` entry `js/__tests__/testing/jest_setup_page.js` exists purely to install
  `#book-title` and an `indexedDB` stub before any module is evaluated.
- Importing any component for any reason opens a database.
- `Renderer.tsx` also calls `addJqueryExtensionMethods()` at module scope, so whether
  `betterDoubleClick` exists depends on whether something in the import graph reached
  `Renderer.tsx`.

Suggested shape: make `driveClient` a lazily-initialized accessor (`getDriveClient()`), and move
the jQuery extension registration into an explicit init step called by `page_runner`.

Unlocks: removal of the global jest setup file; independent component tests that don't touch
storage or Google APIs.

## 11. Renderer entry points boot the app on import

Every page type except `liturgy_renderer.js` ends with `new Runner(new XRenderer(), driveClient).main()`
at module scope. Importing `js/mishna.js` to test `MishnaRenderer` therefore registers a React
root, starts API requests, and installs a service worker. As a result the per-renderer tests in
`renderers.test.tsx` exercise the shared pieces each renderer configures rather than the renderer
classes themselves.

Suggested shape: `export class MishnaRenderer ...` alongside the existing bootstrap, or move the
bootstrap into a `main.js` per page. `liturgy_renderer.js` already does the former and is
imported directly by its tests.

Unlocks: direct tests of each renderer's `newPageTitleHebrew`, `versions`, `ignoredSectionRefs`
and `sortedAmudim` — the Siddur's `sortedAmudim` in particular is ~60 lines of calendar-driven
logic with no coverage.

## 12. `Steinsaltz` and `Translation` share a className

Both commentary kinds declare `className: "translation"`, and `commentaryTypesByClassName` is a
last-one-wins map whose winner changes with `showTranslationButton`. This is the direct cause of
Observation #8 in `FrontendTestingPlan.md`: two unrelated preferences stop working when the
translation button is enabled.

Suggested shape: give Steinsaltz its own className and map the CSS accordingly, or make the
lookup explicit about which kind is intended. Either way, `IndividualComment` should not be
branching on `englishName === "Translation"` to decide behavior that the user configured
elsewhere.

Unlocks: removes a class of bug where enabling one preference disables another.

## 13. `page_runner.js` / `*_renderer.js` are still untyped JS

`page_runner.js` (374 lines) is the actual entry point that wires URL → API → `Renderer`, and it
is plain JS with `navigationExtension` typed as `any` on the React side
(`js/Page.tsx:24` notes this). It is the largest piece of the frontend with no type safety and no
tests. Converting it to TS is a prerequisite for testing navigation/loading behavior with any
confidence.

Unlocks: navigation, prefetch, and multi-page-load coverage — currently the biggest untested
surface.
