import * as React from "react";
import {CommentaryType} from "../commentaries";
import type {Version} from "./Preferences";
import {LocalStorageLru} from "./localStorage";

const {createContext, useContext} = React;

/**
 * The shape assembled in `Renderer.register` (js/Renderer.tsx) and read throughout the render
 * tree via `useConfiguration()`. A few fields are not part of that initial object literal at all:
 * `selectedView` and `selectedCommentaryView` are assigned later by `Keybindings`, and `isFake` is
 * only set on the hidden measuring host's copy.
 */
export interface Configuration {
  rendererType: string;
  versions: () => Version[];
  translationOption: () => string;
  commentaryTypes: CommentaryType[];
  commentaryTypesByClassName: Record<string, CommentaryType>;
  wrapTranslations: () => boolean;
  expandEnglishByDefault: () => boolean;
  ignoredSectionRefs: (id: string) => string[];
  /** Set by `Renderer`, but never read. See Observation #9 in FrontendTestingPlan.md. */
  expandTranslationOnMergedSectionExpansion?: boolean;
  /** Read by `Segment`, but never set. See Observation #9 in FrontendTestingPlan.md. */
  expandTranslationOnMergedSegmentExpansion?: boolean;
  compactLayout: () => boolean;
  highlightedIds: LocalStorageLru;
  toggleHighlightedId: (newState: boolean, sectionId: string) => void;
  searchQueryRegex?: Record<string, string | undefined>;
  isFake?: boolean;
  selectedView?: HTMLElement;
  selectedCommentaryView?: HTMLElement;
}

const DEFAULT_CONTEXT: Partial<Configuration> = {
  versions: () => [],
  rendererType: "default",
};

export const ConfigurationContext = createContext<Configuration | undefined>(undefined);
export function useConfiguration(): Configuration {
  return useContext(ConfigurationContext) ?? (DEFAULT_CONTEXT as Configuration);
}

export const HiddenHostContext = createContext<any>(undefined);
export function useHiddenHost(): any {
  return useContext(HiddenHostContext);
}
