# Frontend (`js/`) Testing Plan

Status: in progress. This file is the living plan; see `FrontendTestabilitySuggestions.md` for
refactoring ideas that are deliberately **not** being acted on.

## Constraints this plan works within

- No functionality or architecture changes. Tests adapt to the code, not the reverse.
- No new npm dependencies. (`node_modules` is already installed; adding deps risks churn in a
  1.2MB lockfile for a Parcel 1.x + React 16 build.)
- The only build-config change is a `transform` entry in the `jest` block of `package.json`, which
  adds `@babel/plugin-transform-react-jsx` **for jest only**. `babel.config.js` is untouched so the
  Parcel production bundle is bit-identical.

## What the code looks like (and why it's hard to test)

The render pipeline is a single deep tree, driven imperatively from outside React:

```
Renderer (abstract class, js/Renderer.tsx)
  └─ register(divId) → ReactDOM.render(
       HiddenHost   ← an off-screen duplicate render used only for measuring text heights
       ConfigurationContext.Provider   ← the app's entire "settings" object, built ad hoc here
         HiddenHostContext.Provider    ← jQuery handles into the HiddenHost DOM
           Root       ← feedback gate, ready gate, forceUpdate escape hatch
             Page     ← title, loading, section merging loop
               Segment    ← merged-segment text, commentary open/close state
                 TableRow ← hebrew/english cells, line-clamp measurement, highlighting
                   CommentariesBlock ← commentary buttons, nesting, show-more
                     IndividualComment ← rows/jagged-array/joined rendering
```

Difficulties, in rough order of severity:

1. **Configuration lives in an untyped object literal** built inside `Renderer.register`
   (`js/Renderer.tsx:229`) and read as `useConfiguration(): any` everywhere. There is no
   declared shape to construct in a test, so a test context has to be reverse-engineered from
   every `context.*` read site.
2. **`localStorage` is the de-facto global settings store**, read directly at render time by at
   least 10 components (`localStorage.languageOption`, `translationOption`, `wrapTranslations`,
   `expandEnglishByDefault`, `showTranslationButton`, `showAlternateVersions`, `layoutOption`,
   `showPageMetadata`, `hideGemaraTranslationByDefault`, `darkMode`, `showFeedbackForm`). Every
   mode of the UI is a `localStorage` permutation, so tests must control it explicitly and reset
   it between cases.
3. **Layout measurement is real-DOM dependent.** `TableRow.shouldTranslationWrap`
   (`js/TableRow.tsx:338`) writes into the HiddenHost via jQuery and reads `.height()`. jsdom
   reports 0 for everything, so the measurement degrades to `NaN` → `{shouldWrap: false,
   lineClamp: 1000000}`. That is a *stable, safe* degradation: it means jsdom tests can render
   the whole tree, but cannot assert on wrap/clamp behavior. Those two outputs are treated as
   out of scope rather than mocked into fiction.
4. **jQuery double-click bindings** (`betterDoubleClick`) are attached in effects and fire on
   *native* events, while React handlers fire on delegated synthetic events. Tests must dispatch
   real `dblclick`/`click` events on real nodes rather than use React's `Simulate`.
5. **Implicit globals**: `gtag`, `componentHandler` (MDL), and specific DOM nodes that must exist
   (`#book-title`, `#darkModeCss`, `#grayModeCss`, `#theme-color`, `#theme-color-dark-mode`).
   `useUpdateDisplayTheme` (`js/hooks.ts:18`) throws if they are absent.
6. **Page identity comes from the URL**, via `amudMetadata()` reading `window.location.pathname`
   and `#book-title`.

## Tooling decision

`ReactDOM.render` + `react-dom/test-utils`' `act`, into a container attached to `document.body`.

Rejected alternatives and why:
- `@testing-library/react` — not installed; would need a v11-era pin for React 16, and its
  `fireEvent` conveniences are largely re-implementable in ~40 lines for this codebase's needs.
- `react-test-renderer` / shallow rendering — useless here: the components' most interesting
  behavior is jQuery event binding and DOM measurement, which require a real DOM.
- Snapshot tests as the primary tool — rejected as the *primary* tool. This UI's output is large,
  Hebrew-heavy HTML; snapshots would lock in noise and would not tell the author *what broke*.
  Used sparingly (see Tier 4).

## Test tiers

### Tier 0 — harness (`js/__tests__/testing/`)
Not tests. Shared infrastructure:
- `dom.tsx` — `mount()`/`unmount()` into a body-attached container inside `act()`, plus
  `click`, `doubleClick`, `keyUp` that dispatch **native** bubbling events (so both React's
  delegated listeners and jQuery's direct listeners fire), plus small query helpers
  (`text()`, `classesOf()`, `queryAll()`).
- `page_environment.ts` — installs/removes the implicit globals and DOM nodes from difficulty
  #5/#6, and resets `localStorage` between tests.
- `context.ts` — builds a `ConfigurationContext` value. Two flavors: a hand-built one for unit
  tests of leaf components, and one obtained from a **real `Renderer` subclass** for integration
  tests, so the integration tests can't drift from the production context shape.
- `fixtures.ts` — builders for `UiPage` / `UiSegment` / `ApiComment` / `CommentaryType`, so a
  test states only the field it cares about.

### Tier 1 — pure logic (fast, high value, no DOM)
Free-standing functions that already encode real rules:
- `mergeCommentaries` — merged-segment commentary joining, Translation/Steinsaltz collapsing.
- `promote_replaceable_ai_comments` — AI version promotion + "Original Text" swap.
- `Renderer._applyClientSideDataTransformations` — uuid backfill, preferred-version swapping,
  the `"both"` translation-mode Steinsaltz→Translation rewrite, and the
  `continuallyRewriteSteinsaltzEnglish` re-entrancy contract. This is the single densest piece
  of untested client-side data logic in the codebase.
- `LocalStorageInt` / `LocalStorageLru` — including the LRU eviction slice, which looks off.
- `CustomThemes`, `is_empty_text`, `mergeCommentaries`, `matching`/`highlight` (already covered),
  `addDriveComments` (marked `TODO: tests here would be great` in the source).

### Tier 2 — hooks
`useIncrementer`, `useAlternator`, `useArrayStateBackedByLength` (whose whole reason for existing
is a subtle React identity issue, documented in a comment and never verified),
`useUpdateDisplayTheme` (theme link toggling + custom-property clearing).

### Tier 3 — components, bottom-up
Each with the smallest context that makes it render:
- `CellText` / `TableRow` — sanitization (`<script>` stripping, `span-highlight` allow-listing),
  search-term wrapping, full-row vs two-cell layout, hebrew-only mode, close button, English
  expand toggle, `expandEnglishByDefault`.
- `IndividualComment` — the four content shapes (`rows`, matched jagged arrays, mismatched
  arrays → joined, plain strings), title row, `directlyReferencedLine`, duplicate-report button.
- `CommentariesBlock` — button list, open/close ordering (append vs prepend), show-more
  threshold, `showTranslationButton` hiding, `ignoreInHebrew`, nested commentaries, highlight
  color indicators, image indicators, dedupe by ref.
- `Segment` — segment merging text join, double-click-to-expand-translation, hidden-host
  "always open rashi" behavior.
- `Page` — title/hebrew title selection, loading spinner + error, section merging loop
  (`defaultMergeWithNext`, `compactLayout`, `lastSegmentOfSection`, hadran separators),
  `ignoredSectionRefs`.
- `Root` — ready gate, feedback gate, `forceUpdateRef`/`setIsReadyRef` wiring.

### Tier 4 — integration through the real `Renderer`
Mount a concrete `Renderer` subclass with `register()`, feed it pages via `setAmud`, and drive it
the way `page_runner` does. Assertions are behavioral ("clicking the Rashi button reveals the
Rashi text; clicking again hides it"), not structural. This tier is where the *modes* get
covered, as a matrix over `localStorage`:
`translationOption` ∈ {english-side-by-side, both, just-hebrew} ×
`languageOption` ∈ {english, hebrew} × `layoutOption` ∈ {default, compact}.

**Deferred:** the plan originally called for a small number of full-tree HTML snapshots here, one
per mode, as change-detectors. These are now held until after the testability refactors land. A
snapshot asserts every class name and wrapper at once without saying which matters, so a refactor
that changes markup harmlessly fails all of them together — leaving a choice between mass
re-recording (which also accepts real regressions) and reading large diffs of Hebrew HTML. Taking
them after the restructuring means they freeze the shape being kept rather than the one about to
change. The targeted assertions used everywhere else survive those refactors untouched.

## Ordering

1. Tier 0 harness + prove the whole tree mounts. ← must work first, everything depends on it
2. Tier 1 (no harness needed, immediate value).
3. Tier 3 bottom-up, since each level's harness needs grow.
4. Tier 2 alongside Tier 3.
5. Tier 4 last, once the context builder is trustworthy.

## Test infrastructure changes made

All of these are test-only; `babel.config.js` and every `js/` source file are untouched.

1. `package.json` → `jest.transform`: routes all `.js/.jsx/.ts/.tsx` through `babel-jest` with
   `configFile: ./babel.jest.config.js`.
2. `babel.jest.config.js` (new): production presets plus JSX, retargeted at the current node.
   The production config targets browsers, which rewrites generators through
   `regeneratorRuntime` — supplied by the bundle's polyfills but not by jest, so importing
   anything reaching `js/useScrollTo.ts` threw at import time.
3. `package.json` → `jest.setupFiles`: adds `js/__tests__/testing/jest_setup_page.js`, which
   installs `#book-title`, `#server-version`, and `indexedDB` / `caches` stubs *before modules
   load*. Several modules do real work at import time — `js/google_drive/singleton.ts` builds a
   `DriveClient` and opens a database, and `js/caches.ts` reads `#server-version` — so a
   `beforeEach` is too late (see suggestion #10).
4. `package.json` → `jest.testPathIgnorePatterns`: excludes `js/__tests__/testing/`, which holds
   the harness rather than tests.

No npm dependencies were added.

## Progress log

- [x] Test infrastructure (above). Pre-existing suite still green throughout.
- [x] Tier 0 harness: `dom.tsx`, `page_environment.ts`, `configuration.tsx`, `fixtures.ts`.
- [x] Tier 1: `mergeCommentaries` (12), `promote_replaceable_ai_comments` (9), `localStorage`
      (16), `Renderer_transformations` (18).
- [x] Tier 2: `hooks` (16), covering `useIncrementer`, `useAlternator`,
      `useArrayStateBackedByLength`, `useUpdateDisplayTheme`.
- [x] Tier 3: `TableRow` (21), `IndividualComment` (23), `CommentariesBlock` (27), `Segment` (22),
      `Page` (33), `Root` (15), `Preferences` (23).
- [x] Tier 4: `renderer_integration` (24), `SearchHighlighting` (12), `Keybindings` (17),
      `page_runner` (24) — first render, commentary interaction, multi-page load/removal,
      translation and layout modes, Drive notes, the feedback gate, in-page search, keyboard
      navigation, and url/api-driven navigation.
- [ ] Deferred until after the testability refactors: per-mode snapshots (see Tier 4 above).

Total: 493 tests across 63 suites, up from 182 across 48.

### Not covered, and why

- **Wrap / line-clamp heuristics** — unreachable in jsdom; needs suggestion #4.
- **Google Drive sync** (`google_drive/client.ts`, 705 lines) — has its own existing tests for
  document parsing; the sign-in and write paths need a gapi fake that does not exist yet.
- **`ref_selection_snackbar`** — driven by real text selection ranges, which jsdom models poorly.
- **Service worker and offline mode** — no service worker in jsdom.
- **`Runner.main()`** — the `$(document).ready` bootstrap. Its constituent parts are covered;
  the bootstrap itself schedules timers and a service-worker registration.

## Observations found while writing tests

Behaviors that looked surprising. None have been changed; each is pinned by a test that documents
the current behavior, so a deliberate change will show up as a failing test.

1. **`isUnique: false` is honored for buttons but not for display.**
   `CommentariesBlock.forEachCommentary` filters out comments with `isUnique === false` when
   deciding which buttons to render, so a commentary whose comments are *all* non-unique gets no
   button. But `getOpenCommentariesInOrder` reads the commentary straight out of the map with no
   filtering, so a commentary with a mix of unique and non-unique comments displays all of them
   once opened. Pinned in `CommentariesBlock.test.tsx`.

2. **jsdom cannot exercise the wrap/line-clamp heuristics.** Every height is 0, so
   `shouldTranslationWrap` divides 0 by 0 and takes its `NaN` branch. Every test therefore runs
   in the "could not measure" layout. See suggestion #4 for what would make this testable.

3. **The URL range and the loaded pages must be kept in sync, or rendering throws.**
   `Renderer.sortedAmudim()` maps `amudMetadata().range()` through `this.allAmudim`, so if the URL
   names an amud that has not been registered, `addDriveComments` dereferences `undefined.sections`
   and the whole tree fails to render. Production stays safe only because
   `page_runner.requestSection` registers a loading placeholder *before* calling `updateUrl`. Any
   future path that changes the URL first — a `popstate` handler, a deep link, a restored
   session — would break the page. The integration tests follow the production ordering and say so.

4. **Keyboard navigation walks through the hidden host's rows first.**
   `Keybindings` navigates `#results .table-row`, but `Renderer.register` renders the hidden
   measuring host into that same element, so its rows are matched too — and they come first in
   document order. On a page with two segments that is 4 invisible rows ahead of the real ones, so
   the first four `j` presses do nothing a reader can see. Pinned in `Keybindings.test.tsx`.

5. **The keyboard selection highlight trails the cursor by one press.**
   `Keybindings` assigns `context.selectedView` and `context.selectedCommentaryView` inside a
   `useEffect`, which runs *after* the render that reads them, and nothing re-renders afterward. So
   the highlighted row is always the previously focused one. Three visible consequences, each
   pinned by a test: the last row can never be highlighted; the highlighted commentary button is
   never the one `o` will open; and pressing `o` twice does not close what it opened, because
   opening a commentary changes the button list the cursor was pointing into.

   Both of these would be fixed by the same change — scoping the row query to the visible page and
   putting the selection in React state rather than on the mutable context object.

6. **Loading a neighbouring page shows no loading state.**
   `Runner.requestSection` registers the loading placeholder, *then* extends the url, and nothing
   re-renders in between — `PromiseQueue.add` defers the request to a microtask, after
   `updateUrl`. Since the renderer only shows pages named by the url range, the placeholder and its
   spinner are invisible until the response or an error triggers the next render. The spinner does
   work on first page load, where the url already covers the range. A `forceUpdate()` after
   `updateUrl` would fix it. Pinned in `page_runner.test.tsx`.

7. **The first update from `useArrayStateBackedByLength` always re-renders.** The backing state is
   `useState(0)` rather than `useState(array.length)`, so the initial set of a non-empty array is
   seen as a change even when nothing changed. Harmless, but it means the hook saves fewer renders
   than it appears to.
