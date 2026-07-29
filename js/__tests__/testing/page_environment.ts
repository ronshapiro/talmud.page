/**
 * The implicit page environment that the frontend assumes exists.
 *
 * The components read a number of globals and specific DOM nodes that are supplied by the
 * server-rendered template (`templates/`) and by third-party scripts, none of which exist under
 * jest. Rather than mocking the modules that touch them, this installs the same surface so the
 * production code path runs unmodified:
 *
 *   - `#book-title`      : read by `amudMetadata()` to identify the book.
 *   - `#darkModeCss`, `#grayModeCss`, `#theme-color`, `#theme-color-dark-mode`
 *                        : required by `useUpdateDisplayTheme()`, which throws without them.
 *   - `#metaBookSections`: optional, read by `tryReadHardcodedSections()` for non-Talmud books.
 *   - `gtag`             : called on every commentary button click.
 *   - `componentHandler` : Material Design Lite's upgrade hook, called from several effects.
 *
 * It also installs the jQuery extension methods (`betterDoubleClick`, `isInViewport`). In
 * production these are registered as a side effect of importing `js/Renderer.tsx`; components
 * mounted directly in a test would otherwise fail in their first effect.
 */
import {addJqueryExtensionMethods} from "../../jquery";

export interface GtagCall {
  event: string;
  parameters: Record<string, unknown>;
}

export interface PageEnvironment {
  /** Every `gtag("event", ...)` call made since installation. */
  gtagCalls: GtagCall[];
  /** Elements passed to `componentHandler.upgradeElement`. */
  upgradedElements: HTMLElement[];
  upgradeAllRegisteredCount: () => number;
}

export interface PageEnvironmentOptions {
  /** The book name, as the server writes into `#book-title`. Defaults to "Berakhot". */
  book?: string;
  /** The path, which determines the amud range. Defaults to `/<book>/2a`. */
  path?: string;
  /** Section names for non-Talmud books, base64'd into `#metaBookSections` as the server does. */
  bookSections?: string[];
}

const ELEMENT_IDS = [
  "book-title",
  "metaBookSections",
  "darkModeCss",
  "grayModeCss",
  "theme-color",
  "theme-color-dark-mode",
];

function meta(id: string, content: string): HTMLMetaElement {
  const element = document.createElement("meta");
  element.id = id;
  element.content = content;
  document.head.append(element);
  return element;
}

function stylesheet(id: string): HTMLLinkElement {
  const element = document.createElement("link");
  element.id = id;
  element.rel = "stylesheet";
  document.head.append(element);
  return element;
}

export function clearPageEnvironment(): void {
  for (const id of ELEMENT_IDS) {
    document.getElementById(id)?.remove();
  }
  delete (window as any).gtag;
  delete (window as any).componentHandler;
  localStorage.clear();
}

export function installPageEnvironment(options: PageEnvironmentOptions = {}): PageEnvironment {
  clearPageEnvironment();
  addJqueryExtensionMethods();

  const book = options.book ?? "Berakhot";
  meta("book-title", book);
  if (options.bookSections) {
    meta("metaBookSections", btoa(JSON.stringify(options.bookSections)));
  }
  stylesheet("darkModeCss");
  stylesheet("grayModeCss");
  meta("theme-color", "");
  meta("theme-color-dark-mode", "");

  window.history.replaceState({}, "", options.path ?? `/${book}/2a`);

  let upgradeAllRegisteredCount = 0;
  const environment: PageEnvironment = {
    gtagCalls: [],
    upgradedElements: [],
    upgradeAllRegisteredCount: () => upgradeAllRegisteredCount,
  };

  (window as any).gtag = (_kind: string, event: string, parameters: Record<string, unknown>) => {
    environment.gtagCalls.push({event, parameters});
  };
  (window as any).componentHandler = {
    upgradeElement: (element: HTMLElement) => environment.upgradedElements.push(element),
    upgradeAllRegistered: () => { upgradeAllRegisteredCount++; },
  };

  return environment;
}
