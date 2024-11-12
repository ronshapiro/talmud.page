import * as React from "react";
import {render} from 'react-dom';
import {throttle} from "underscore";
import {v4 as newUuid} from "uuid";
import {addDriveComments} from "./addDriveComments";
import {amudMetadata} from "./amud";
import {CorrectionModal} from "./CorrectionModal";
import {CommentEditorModal} from "./CommentEditorModal";
import {$, addJqueryExtensionMethods} from "./jquery";
import {LocalStorageInt, LocalStorageLru} from "./localStorage";
import {
  ConfigurationContext,
  HiddenHostContext,
} from "./context";
import {Root} from "./Root";
import {CommentaryType} from "../commentaries";
import {Section as Segment, Commentary} from "../apiTypes";
import {UiPage} from "./Page";
import {DriveClient} from "./google_drive/client";
import {NavigationExtension} from "./NavigationExtension";

addJqueryExtensionMethods();

function indexCommentaryTypesByClassName(
  commentaryTypes: CommentaryType[]): Record<string, CommentaryType> {
  const result: Record<string, CommentaryType> = {};
  for (const type of commentaryTypes) {
    result[type.className] = type;
  }
  return result;
}

class FakeRef<T> {
  current: T = undefined as any;
}

interface Options {
  isTalmud?: boolean;
  translationOverride?: string;
  allowCompactLayout?: boolean;
  expandTranslationOnMergedSectionExpansion?: boolean;
}

export class Renderer {
  allAmudim: Record<string, UiPage> = {};
  forceUpdateRef = new FakeRef<() => void>();
  setIsReady = new FakeRef<() => void>();
  driveClient: DriveClient = undefined as any; // Set externally
  allowCompactLayout: boolean | undefined;
  expandTranslationOnMergedSectionExpansion: boolean | undefined;
  isTalmud: boolean | undefined;
  wrapTranslations = (): boolean => localStorage.wrapTranslations !== "false";
  expandEnglishByDefault = (): boolean => localStorage.expandEnglishByDefault === "true";
  translationOption: () => string;

  constructor(
    private readonly commentaryTypes: CommentaryType[],
    readonly navigationExtension: NavigationExtension,
    options: Options,
  ) {
    options = options || {};
    this.isTalmud = options.isTalmud;
    this.translationOption = () => {
      return (
        options.translationOverride
          || localStorage.translationOption
          || "english-side-by-side");
    };
    this.allowCompactLayout = options.allowCompactLayout;
    this.expandTranslationOnMergedSectionExpansion = (
      options.expandTranslationOnMergedSectionExpansion);
  }

  _applyClientSideDataTransformations(amudData: UiPage): void {
    if (!amudData.sections) {
      amudData.sections = [];
    }

    for (const section of amudData.sections) {
      if (!section.uuid) {
        section.uuid = newUuid();
      }
    }

    // TODO: this logic is not dynamic, and therefore can result in some weird states when settings
    // are changed for already-viewed translations. It may be best to just inline this logic to the
    // UI code instead of modifying the data.
    if (this.translationOption() !== "both") {
      return;
    }

    for (const section of amudData.sections) {
      const commentaries = section.commentary;
      // Reminder: Hadran sections have no steinsaltz
      if (commentaries?.Steinsaltz) {
        section.steinsaltzRetained = true;
        commentaries.Translation = commentaries.Steinsaltz;
        delete commentaries.Steinsaltz;
      } else if (section.ref.indexOf("Hadran ") === 0 || !this.isTalmud) {
        if (!section.commentary) section.commentary = {};
        section.commentary.Translation = {
          comments: [{
            ref: section.ref,
            en: section.en,
            he: "",
            sourceRef: "",
            sourceHeRef: "",
          }],
        };
      }

      // rewriting is deferred here since on successive calls to this method, the
      // commentaries.Steinsaltz property may be already deleted, but we still want to persist the
      // rewriting, i.e. for text highlighting
      if (section.steinsaltzRetained) {
        commentaries!.Translation.comments[0].en = section.en;
      }
    }
  }

  ignoredSectionRefs(_id: string): string[] {
    return [];
  }

  register(divId: string): void {
    const host = document.getElementById(divId)!;
    const hiddenHost = document.createElement("div");
    hiddenHost.id = `${divId}-hidden`;
    hiddenHost.className = "hidden-host";
    host.parentNode!.insertBefore(hiddenHost, host);

    const context = {
      translationOption: this.translationOption,
      commentaryTypes: this.commentaryTypes,
      commentaryTypesByClassName: indexCommentaryTypesByClassName(this.commentaryTypes),
      wrapTranslations: this.wrapTranslations,
      expandEnglishByDefault: this.expandEnglishByDefault,
      hiddenHost,
      ignoredSectionRefs: (id: string) => this.ignoredSectionRefs(id),
      expandTranslationOnMergedSectionExpansion: this.expandTranslationOnMergedSectionExpansion,
      compactLayout: () => this.allowCompactLayout && localStorage.layoutOption === "compact",
      highlightedIds: new LocalStorageLru(
        "highlightedIds",
        // 100 seems like enough to make sure that we don't save too much data, but also don't have
        // to worry about needing to re-render. This isn't "state", so theoretically when something
        // gets booted from the cache, it won't be actually removed here, but if there is a full
        // re-render or refresh, the state could change. That seems probably safe.
        100),
      forceFullUpdate: () => this.forceUpdate(),
      toggleHighlightedId: (newState: boolean, sectionId: string) => {
        if (newState) {
          context.highlightedIds.add(sectionId);
        } else {
          context.highlightedIds.remove(sectionId);
        }
      },
      searchQueryRegex: undefined,
    };

    const hiddenData: UiPage[] = [{
      id: hiddenHost.id,
      title: "hidden",
      titleHebrew: "hidden",
      sections: [{
        en: "H",
        he: "H",
        ref: "hidden",
        uuid: "hidden-uuid",
        commentary: {
          Rashi: {
            comments: [{
              en: "R",
              he: "ר",
              ref: "rashi-hidden",
              sourceRef: "rashi-ref",
              sourceHeRef: "rashi-ref",
            }],
          },
        },
      }],
    }];

    const contextForHiddenHostRendering = {
      ...context,
      translationOption: () => "english-side-by-side",
      wrapTranslations: () => false,
      isFake: true,
    };
    render(
      <ConfigurationContext.Provider value={contextForHiddenHostRendering}>
        <Root
          allAmudim={() => hiddenData}
          navigationExtension={this.navigationExtension}
          isFake />
      </ConfigurationContext.Provider>,
      hiddenHost);

    const $hiddenHost = $(hiddenHost);
    const hiddenHostContext = {
      hebrew: $hiddenHost.find(".gemara-container .hebrew"),
      english: $hiddenHost.find(".gemara-container .english"),
      forComments: {
        hebrew: $hiddenHost.find(".commentaryRow[sefaria-ref] .hebrew"),
        english: $hiddenHost.find(".commentaryRow[sefaria-ref] .english"),
      },
    };

    render(
      <ConfigurationContext.Provider value={context}>
        <HiddenHostContext.Provider value={hiddenHostContext}>
          <Root
            allAmudim={() => this.getAmudim()}
            setIsReadyRef={this.setIsReady}
            forceUpdateRef={this.forceUpdateRef}
            navigationExtension={this.navigationExtension} />
          <CorrectionModal />
          <CommentEditorModal />
        </HiddenHostContext.Provider>
      </ConfigurationContext.Provider>,
      host);

    $(window).resize(throttle(() => this.forceUpdate(), 500));

    const pageViews = new LocalStorageInt("pageViews").getAndIncrement();
    if (pageViews === 10
        || pageViews === 100
        || (pageViews > 0 && pageViews % 248 === 0)) {
      localStorage.showFeedbackForm = "true";
    }
  }

  setAmud(amudData: UiPage): void {
    this.allAmudim[amudData.id] = amudData;
    this.forceUpdate();
  }

  deleteAmud(id: string): void {
    delete this.allAmudim[id];
    this.forceUpdate();
  }

  declareReady(): void {
    if (this.setIsReady.current === null) {
      setTimeout(() => this.declareReady(), 200);
    } else {
      this.setIsReady.current();
    }
  }

  forceUpdate(): void {
    if (this.forceUpdateRef.current === null) {
      setTimeout(() => this.forceUpdate(), 200);
    } else {
      this.forceUpdateRef.current();
    }
  }

  getAmudim(): UiPage[] {
    const amudim = addDriveComments(this.sortedAmudim(), this.driveClient);
    amudim.forEach(amud => this._applyClientSideDataTransformations(amud));
    return amudim;
  }

  personalCommentsForRefs(refs: string[]): Commentary | undefined {
    const unflattened: Commentary[] = refs.map(
      ref => this.driveClient.commentsForRef(ref)).flatMap(x => (x === undefined ? [] : [x]));
    const flattened = [];
    for (const comment of unflattened) {
      flattened.push(...comment.comments);
    }
    return flattened.length > 0 ? {comments: flattened} : undefined;
  }

  sortedAmudim(): UiPage[] {
    return amudMetadata().range().map(key => this.allAmudim[key]);
  }

  newPageTitle(section: Segment): string {
    const metadata = amudMetadata();
    return `${metadata.masechet} ${section}`;
  }

  newPageTitleHebrew(section: Segment): string {
    return this.newPageTitle(section);
  }
}
