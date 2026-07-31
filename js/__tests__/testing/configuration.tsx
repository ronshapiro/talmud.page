/**
 * Builders for the two React contexts the render tree depends on.
 *
 * `testConfiguration` mirrors the object literal in `Renderer.register` (js/Renderer.tsx),
 * including which fields are *functions* — several of them are lazily re-read from `localStorage`
 * on every render, so tests that flip a setting between renders depend on that laziness.
 *
 * `HiddenHostContext` carries jQuery handles into an off-screen duplicate render, used by
 * `TableRow` to measure text. Real (detached) jQuery nodes are used rather than fakes: jsdom
 * reports every height as 0, which makes the measurement produce NaN and fall back to
 * "don't wrap", exactly as the production code does when it cannot measure.
 */
import * as React from "react";
import {Configuration, ConfigurationContext, HiddenHostContext} from "../../context";
import {CommentaryType} from "../../../commentaries";
import {getCommentaryTypes} from "../../commentaryTypes";
import {LocalStorageLru} from "../../localStorage";
import {$} from "../../jquery";

export type TestConfiguration = Configuration;

export function indexByClassName(types: CommentaryType[]): Record<string, CommentaryType> {
  const result: Record<string, CommentaryType> = {};
  for (const type of types) {
    result[type.className] = type;
  }
  return result;
}

export function testConfiguration(
  overrides: Partial<TestConfiguration> = {},
): TestConfiguration {
  const commentaryTypes = overrides.commentaryTypes ?? getCommentaryTypes("talmud");
  const configuration: TestConfiguration = {
    rendererType: "Talmud",
    versions: () => [],
    // Matches Renderer's construction: hebrew language mode overrides the stored option.
    translationOption: () => {
      if (localStorage.languageOption === "hebrew") return "just-hebrew";
      return localStorage.translationOption || "english-side-by-side";
    },
    commentaryTypes,
    commentaryTypesByClassName: indexByClassName(commentaryTypes),
    wrapTranslations: () => localStorage.wrapTranslations !== "false",
    expandEnglishByDefault: () => localStorage.expandEnglishByDefault === "true",
    ignoredSectionRefs: () => [],
    compactLayout: () => localStorage.layoutOption === "compact",
    highlightedIds: new LocalStorageLru("highlightedIds", 100),
    toggleHighlightedId: (newState: boolean, sectionId: string) => {
      if (newState) configuration.highlightedIds.add(sectionId);
      else configuration.highlightedIds.remove(sectionId);
    },
    searchQueryRegex: undefined,
    ...overrides,
  };
  if (overrides.commentaryTypes && !overrides.commentaryTypesByClassName) {
    configuration.commentaryTypesByClassName = indexByClassName(overrides.commentaryTypes);
  }
  return configuration;
}

export interface HiddenHost {
  hebrew: any;
  english: any;
  forComments: {hebrew: any, english: any};
}

export function testHiddenHost(): HiddenHost {
  return {
    hebrew: $("<div>"),
    english: $("<div>"),
    forComments: {
      hebrew: $("<div>"),
      english: $("<div>"),
    },
  };
}

interface TestContextProps {
  /** A configuration built by `testConfiguration`, used as-is so its identity is preserved. */
  configuration?: TestConfiguration;
  /** Field-level overrides on top of the defaults. Ignored if `configuration` is given. */
  overrides?: Partial<TestConfiguration>;
  hiddenHost?: HiddenHost;
  children: React.ReactNode;
}

/**
 * Wraps `children` in both providers, with production-shaped defaults.
 *
 * The configuration and hidden host are built once and kept stable across re-renders, matching
 * production, where both are created a single time in `Renderer.register`. Some components mutate
 * the configuration in place (`searchQueryRegex`, `selectedView`), so a fresh object per render
 * would silently drop those writes.
 */
export function TestContext({
  configuration,
  overrides,
  hiddenHost,
  children,
}: TestContextProps): React.ReactElement {
  const stable = React.useRef<{configuration: TestConfiguration, hiddenHost: HiddenHost}>();
  if (!stable.current) {
    stable.current = {
      configuration: configuration ?? testConfiguration(overrides ?? {}),
      hiddenHost: hiddenHost ?? testHiddenHost(),
    };
  }
  return (
    <ConfigurationContext.Provider value={stable.current.configuration}>
      <HiddenHostContext.Provider value={stable.current.hiddenHost}>
        {children}
      </HiddenHostContext.Provider>
    </ConfigurationContext.Provider>
  );
}
