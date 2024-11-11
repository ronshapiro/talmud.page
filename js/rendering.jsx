import React, {
  createRef,
} from "react";
import {render} from 'react-dom';
import _ from "underscore";
import {v4 as newUuid} from "uuid";
import {addDriveComments} from "./addDriveComments.ts";
import {amudMetadata} from "./amud.ts";
import {CorrectionModal} from "./CorrectionModal.tsx";
import {CommentEditorModal} from "./CommentEditorModal.tsx";
import {$, addJqueryExtensionMethods} from "./jquery";
import {LocalStorageInt, LocalStorageLru} from "./localStorage";
import {
  ConfigurationContext,
  HiddenHostContext,
} from "./context.ts";
import {Root} from "./Root.tsx";

addJqueryExtensionMethods();

const indexCommentaryTypesByClassName = (commentaryTypes) => {
  const result = {};
  for (const type of commentaryTypes) {
    result[type.className] = type;
  }
  return result;
};

export class Renderer {
  constructor(commentaryTypes, navigationExtension, options) {
    options = options || {};
    this._commentaryTypes = commentaryTypes;
    this._isTalmud = options.isTalmud;
    this._translationOption = () => {
      return (
        options.translationOverride
          || localStorage.translationOption
          || "english-side-by-side");
    };
    this.wrapTranslations = () => localStorage.wrapTranslations !== "false";
    this.expandEnglishByDefault = () => localStorage.expandEnglishByDefault === "true";
    this.amudimRef = createRef();
    this.forceUpdateRef = createRef();
    this.setIsReady = createRef();
    this.allAmudim = {};
    this.navigationExtension = navigationExtension || {
      hasPrevious: () => false,
      hasNext: () => false,
    };
    options = options || {};
    this.allowCompactLayout = options.allowCompactLayout;
    this.expandTranslationOnMergedSectionExpansion = (
      options.expandTranslationOnMergedSectionExpansion);
  }

  _applyClientSideDataTransformations(amudData) {
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
    if (this._translationOption() !== "both") {
      return;
    }

    for (const section of amudData.sections) {
      const commentaries = section.commentary;
      // Reminder: Hadran sections have no steinsaltz
      if (commentaries && commentaries.Steinsaltz) {
        section.steinsaltzRetained = true;
        commentaries.Translation = commentaries.Steinsaltz;
        delete commentaries.Steinsaltz;
      } else if (section.ref.indexOf("Hadran ") === 0 || !this._isTalmud) {
        commentaries.Translation = {
          comments: [{
            ref: section.ref,
            en: section.en,
            he: "",
          }],
        };
      }

      // rewriting is deferred here since on successive calls to this method, the
      // commentaries.Steinsaltz property may be already deleted, but we still want to persist the
      // rewriting, i.e. for text highlighting
      if (section.steinsaltzRetained) {
        commentaries.Translation.comments[0].en = section.en;
      }
    }
  }

  ignoredSectionRefs(_id) {
    return [];
  }

  register(divId) {
    const host = document.getElementById(divId);
    const hiddenHost = document.createElement("div");
    hiddenHost.id = `${divId}-hidden`;
    hiddenHost.className = "hidden-host";
    host.parentNode.insertBefore(hiddenHost, host);

    const context = {
      translationOption: this._translationOption,
      commentaryTypes: this._commentaryTypes,
      commentaryTypesByClassName: indexCommentaryTypesByClassName(this._commentaryTypes),
      wrapTranslations: this.wrapTranslations,
      expandEnglishByDefault: this.expandEnglishByDefault,
      hiddenHost,
      ignoredSectionRefs: (id) => this.ignoredSectionRefs(id),
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
      toggleHighlightedId: (newState, sectionId) => {
        if (newState) {
          context.highlightedIds.add(sectionId);
        } else {
          context.highlightedIds.remove(sectionId);
        }
      },
      searchQueryRegex: undefined,
    };

    const hiddenData = [{
      id: hiddenHost.id,
      sections: [{
        en: "H",
        he: "H",
        ref: "hidden",
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
    window.$hiddenHost = $hiddenHost;
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

    $(window).resize(_.throttle(() => this.forceUpdate(), 500));

    const pageViews = new LocalStorageInt("pageViews").getAndIncrement();
    if (pageViews === 10
        || pageViews === 100
        || (pageViews > 0 && pageViews % 248 === 0)) {
      localStorage.showFeedbackForm = "true";
    }
  }

  setAmud(amudData) {
    this.allAmudim[amudData.id] = amudData;
    this.forceUpdate();
  }

  deleteAmud(id) {
    delete this.allAmudim[id];
    this.forceUpdate();
  }

  declareReady() {
    if (this.setIsReady.current === null) {
      setTimeout(() => this.declareReady(), 200);
    } else {
      this.setIsReady.current();
    }
  }

  forceUpdate() {
    if (this.forceUpdateRef.current === null) {
      setTimeout(() => this.forceUpdate(), 200);
    } else {
      this.forceUpdateRef.current();
    }
  }

  getAmudim() {
    const amudim = addDriveComments(this.sortedAmudim(), this.driveClient);
    amudim.forEach(amud => this._applyClientSideDataTransformations(amud));
    return amudim;
  }

  personalCommentsForRefs(refs) {
    const unflattened = refs.map(ref => this.driveClient.commentsForRef(ref)).filter(x => x);
    const flattened = [];
    for (const comment of unflattened) {
      flattened.push(...comment.comments);
    }
    return flattened.length > 0 ? {comments: flattened} : undefined;
  }

  sortedAmudim() {
    return amudMetadata().range().map(key => this.allAmudim[key]);
  }

  newPageTitle(section) {
    const metadata = amudMetadata();
    return `${metadata.masechet} ${section}`;
  }

  newPageTitleHebrew(section) {
    return this.newPageTitle(section);
  }
}
