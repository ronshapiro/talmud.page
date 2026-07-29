/**
 * Drives a real `Renderer` the way `page_runner` does, for end-to-end tests.
 *
 * This deliberately goes through `Renderer.register()` rather than mounting `Root` directly, so
 * that the configuration under test is the production one — including the hidden host, the
 * modals, and the ready/force-update handshake.
 *
 * Note that `register()` also increments the stored page-view count, which is what triggers the
 * feedback form on the 10th, 100th and every 248th view. Tests that mount many pages in one file
 * would eventually trip it, so the counter is reset here on every mount.
 */
import {Renderer} from "../../Renderer";
import {getCommentaryTypes} from "../../commentaryTypes";
import {UiPage} from "../../Page";
import {DriveClient} from "../../google_drive/client";
import {amudMetadata, computeNextAmud, computePreviousAmud} from "../../amud";
import {books} from "../../books";
import {flush, trackContainer} from "./dom";

export interface HarnessOptions {
  isTalmud?: boolean;
  allowCompactLayout?: boolean;
  translationOverride?: string;
  expandTranslationOnMergedSectionExpansion?: boolean;
  /** Refs that the renderer should skip, as the siddur and Mishneh Torah renderers do. */
  ignoredSectionRefs?: string[];
  driveClient?: Partial<DriveClient>;
}

class HarnessRenderer extends Renderer {
  constructor(private readonly harnessOptions: HarnessOptions) {
    // Mirrors the navigation extension that talmud_page.js builds, so that the amud arithmetic
    // driving the url range is the real one. A stub with fixed values would let the url name
    // pages that were never loaded, which crashes `sortedAmudim`.
    const previous = () => computePreviousAmud(amudMetadata().amudStart!);
    const next = () => computeNextAmud(amudMetadata().amudEnd!);
    super(
      getCommentaryTypes("talmud"),
      {
        previous,
        next,
        displayPrevious: previous,
        displayNext: next,
        hasPrevious: () => amudMetadata().amudStart !== books[amudMetadata().masechet].start,
        hasNext: () => amudMetadata().amudEnd !== books[amudMetadata().masechet].end,
        loadPrevious: () => {},
        loadNext: () => {},
        defaultEditText: () => "",
      },
      harnessOptions);
  }

  newPageTitleHebrew(section: string): string {
    return `ברכות ${section}`;
  }

  rendererType(): string {
    return "Talmud";
  }

  ignoredSectionRefs(): string[] {
    return this.harnessOptions.ignoredSectionRefs ?? [];
  }
}

export interface MountedRenderer {
  container: HTMLElement;
  renderer: Renderer;
  /** Adds or replaces a page and flushes the resulting render. */
  setPage: (amudData: UiPage) => void;
  removePage: (id: string) => void;
  declareReady: () => void;

  /**
   * Queries the visible page only.
   *
   * The hidden measuring host renders a second, complete copy of the tree into the same React
   * root — including a duplicate `#inner-content` — so an unfiltered `querySelectorAll` returns
   * each element twice. These helpers drop anything inside `.hidden-host`.
   */
  all: (selector: string) => HTMLElement[];
  find: (selector: string) => HTMLElement;
  findOrNull: (selector: string) => HTMLElement | null;
  textsOf: (selector: string) => string[];
}

/**
 * Mounts a renderer into a fresh container and declares it ready, leaving it in the state a real
 * page reaches once its first API response has arrived.
 */
export function mountRenderer(
  pages: UiPage[], options: HarnessOptions & {declareReady?: boolean} = {},
): MountedRenderer {
  localStorage.pageViews = "0";

  // Mirrors templates/rendering_page_body.html: the renderer is registered into `#results`, which
  // sits inside `#main-contents`. Both ids matter — `TableRow` measures `#main-contents` to decide
  // when to recompute wrapping, and `Keybindings` scopes its row navigation to `#results`.
  const container = document.createElement("div");
  container.id = "results";
  const mainContents = document.createElement("div");
  mainContents.id = "main-contents";
  mainContents.append(container);
  document.body.append(mainContents);
  trackContainer(container);

  const renderer = new HarnessRenderer(options);
  renderer.driveClient = (options.driveClient ?? {
    commentsForRef: () => undefined,
    highlightsForRef: () => [],
  }) as DriveClient;

  flush(() => renderer.register(container.id));
  for (const amudData of pages) {
    flush(() => renderer.setAmud(amudData));
  }
  if (options.declareReady !== false) {
    flush(() => renderer.declareReady());
  }

  const isHidden = (element: Element) => element.closest(".hidden-host") !== null;
  const all = (selector: string) => (
    [...container.querySelectorAll(selector)].filter(x => !isHidden(x)) as HTMLElement[]);
  const findOrNull = (selector: string) => all(selector)[0] ?? null;

  return {
    container: mainContents,
    renderer,
    setPage: (amudData: UiPage) => flush(() => renderer.setAmud(amudData)),
    removePage: (id: string) => flush(() => renderer.deleteAmud(id)),
    declareReady: () => flush(() => renderer.declareReady()),
    all,
    findOrNull,
    find: (selector: string) => {
      const result = findOrNull(selector);
      if (!result) throw new Error(`Nothing on the visible page matched ${selector}`);
      return result;
    },
    textsOf: (selector: string) => all(selector).map(x => x.textContent ?? ""),
  };
}
