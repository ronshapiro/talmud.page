/* global componentHandler */
import React, {
  Component,
  createRef,
  useEffect,
} from "react";
import {render} from 'react-dom';
import PropTypes from 'prop-types';
import _ from "underscore";
import {v4 as newUuid} from "uuid";
import {addDriveComments} from "./addDriveComments.ts";
import {amudMetadata} from "./amud.ts";
import {CorrectionModal} from "./CorrectionModal.tsx";
import {CommentEditorModal} from "./CommentEditorModal.tsx";
import {FeedbackView} from "./Feedback.tsx";
import {hebrewSearchRegex} from "../hebrew";
import {$, addJqueryExtensionMethods} from "./jquery";
import {LocalStorageInt, LocalStorageLru} from "./localStorage";
import {
  NextButton,
  PreviousButton,
} from "./NavigationButtons.tsx";
import {PageTitleMetadata} from "./PageTitleMetadata.tsx";
import {
  ConfigurationContext,
  HiddenHostContext,
} from "./context.ts";
import {Preferences} from "./Preferences.tsx";
import {SnackbarHost} from "./SnackbarReact.tsx";
import {Keybindings} from "./Keybindings";
import {Segment} from "./Segment.tsx";

addJqueryExtensionMethods();

class Amud extends Component {
  static propTypes = {
    amudData: PropTypes.object,
    navigationExtension: PropTypes.object,
    firstRemovable: PropTypes.bool,
    lastRemovable: PropTypes.bool,
  };

  static contextType = ConfigurationContext;

  headerRef = createRef();

  state = {
    showing: true,
    expandMergedRef: {},
  };

  _renderTitle() {
    const {amudData, navigationExtension, firstRemovable, lastRemovable} = this.props;
    const removableStyle = firstRemovable || lastRemovable ? {} : {visibility: "hidden"};
    const onClick = () => {
      if (firstRemovable) navigationExtension.removeFirst();
      else if (lastRemovable) navigationExtension.removeLast();
    };
    // TODO: load buttons should also display hebrew text. This may be easier if the API returns
    // the texts instead of computing them on the client. This will also solve the problem of
    // missing Hebrew title text when loading the next page.
    const isEnglishTitle = this.context.translationOption() === "english-side-by-side";
    const title = isEnglishTitle ? amudData.title : amudData.titleHebrew;
    const className = isEnglishTitle ? "title" : "titleHebrew";
    const removeSectionButton = navigationExtension.disableNavigation ? undefined : (
      <button
        className="mdl-button mdl-js-button mdl-button--icon mdl-button remove-section-button"
        style={removableStyle}
        onClick={() => onClick()}>
        <i className="material-icons">do_not_disturb_on</i>
      </button>
    );
    return (
      <div className="titleContainer" key="titleContainer">
        <span className={className} key="title" ref={this.headerRef}>
          {title}
          {localStorage.showPageMetadata === "true"
           && !amudData.loading
           && <> <PageTitleMetadata segments={amudData.sections} /></>}
        </span>
        {removeSectionButton}
      </div>);
  }

  render() {
    const {amudData} = this.props;
    const output = [];
    if (amudData.title) { // only in the case of the hidden host
      output.push(this._renderTitle());
    }
    if (amudData.loading) {
      output.push(
        <div
          key={`${amudData.id}-loading-spinner`}
          className="text-loading-spinner mdl-spinner mdl-spinner--single-color mdl-js-spinner is-active" />);
    }

    // TODO: if not showing, update the UI so it's clear that it's collapsed
    if (this.state.showing) {
      const ignoredRefs = new Set(this.context.ignoredSectionRefs(amudData.id));
      const sections = amudData.sections.filter(x => !ignoredRefs.has(x.ref));
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];

        const makeSeparator = () => <br key={`separator-${i}`} className="section-separator" />;
        if (i !== 0 && (
          section.steinsaltz_start_of_sugya
            || section.hadran
            || section.ref === "Hadran 1")) {
          output.push(makeSeparator());
        }

        const sectionLabel = `${amudData.id}_section_${i + 1}`;
        const mergedSections = [section];
        while (i < sections.length) {
          const currentSection = sections[i];
          const nextSection = sections[i + 1];
          if (currentSection.lastSegmentOfSection) break;
          if (!currentSection.defaultMergeWithNext && !this.context.compactLayout()) break;
          if (this.state.expandMergedRef[currentSection.uuid]) break;
          if (nextSection && (
            this.state.expandMergedRef[nextSection.uuid]
              || nextSection.steinsaltz_start_of_sugya
              || nextSection.hadran
              || nextSection.ref.startsWith("Hadran "))) {
            break;
          }
          i++;
          if (i === sections.length) {
            break;
          }
          mergedSections.push(nextSection);
        }
        const toggleMerging = (uuid) => {
          this.setState(previousState => {
            const newState = {
              ...previousState,
              expandMergedRef: {...previousState.expandMergedRef},
              lastUnexpandedUuid: undefined,
            };
            newState.expandMergedRef[uuid] = !newState.expandMergedRef[uuid];
            if (!newState.expandMergedRef[uuid]) {
              newState.lastUnexpandedUuid = uuid;
            }
            return newState;
          });
        };
        output.push(
          <Segment
            key={mergedSections[0].uuid + "+" + (mergedSections.length - 1)}
            segments={mergedSections}
            segmentLabel={sectionLabel}
            toggleMerging={toggleMerging}
            isExpanded={this.state.expandMergedRef[mergedSections[0].uuid]}
            lastUnexpandedUuid={this.state.lastUnexpandedUuid}
            />);
        if (i < sections.length - 1 && mergedSections.at(-1).lastSegmentOfSection) {
          output.push(makeSeparator());
        }
      }
    }
    return (
      <div id={`amud-${amudData.id}`} className="amudContainer" amud={amudData.id}>
        {output}
      </div>
    );
  }

  componentDidMount() {
    $(this.headerRef.current).betterDoubleClick(() => {
      this.setState(previousState => {
        return {...previousState, showing: !previousState.showing};
      });
    });
  }
}

function RootHooks() {
  useEffect(() => {
    document.getElementById("darkModeCss").disabled = localStorage.darkMode !== "true";
    for (const id of ["theme-color", "theme-color-dark-mode"]) {
      document.getElementById(id).content = (
        getComputedStyle(document.body).getPropertyValue('--background-color'));
    }
  });
  return null;
}

class Root extends Component {
  static propTypes = {
    allAmudim: PropTypes.func.isRequired,
    isFake: PropTypes.bool,
    navigationExtension: PropTypes.object.isRequired,
  };

  state = {queryCount: 0}
  static contextType = ConfigurationContext;

  render() {
    const {
      isFake,
      allAmudim,
      navigationExtension,
    } = this.props;
    if (!isFake && !this.state.isReady) {
      return [];
    }

    if (!isFake && localStorage.showFeedbackForm === "true") {
      const hideState = () => this.setState(oldState => {
        return {...oldState, feedbackTrigger: !oldState.feedbackTrigger};
      });
      return <FeedbackView hide={() => hideState()} />;
    }

    const baseAmudim = allAmudim();
    const amudim = baseAmudim.map((amud, i) => (
      <Amud
        key={amud.id + "-amud"}
        amudData={amud}
        navigationExtension={navigationExtension}
        firstRemovable={i === 0 && baseAmudim.length > 1}
        lastRemovable={i !== 0 && i === baseAmudim.length - 1} />));

    const updateSearchQuery = (color, query, asRegex) => {
      if (!this.context.searchQueryRegex) {
        this.context.searchQueryRegex = {};
      }
      this.context.searchQueryRegex[color] = (
        (query.length < 2) ? undefined : hebrewSearchRegex(query, asRegex));
      this.setState(previousState => {
        return {...previousState, query, queryCount: previousState.queryCount + 1};
      });
    };

    return (
      <>
        <div id="inner-content">
          <PreviousButton navigationExtension={navigationExtension} />
          {amudim}
          <NextButton navigationExtension={navigationExtension} />
          <Preferences rerender={() => this.forceUpdate()} />
        </div>
        {!isFake && (
          <>
            <SnackbarHost
              updateSearchQuery={updateSearchQuery}
              queryCount={this.state.queryCount} />
            <Keybindings />
          </>
        )}
        <RootHooks />
      </>
    );
  }

  componentDidMount() {
    this.registerMdl();
  }

  componentDidUpdate() {
    this.registerMdl();
  }

  registerMdl() {
    // Make sure mdl always registers new views correctly
    componentHandler.upgradeAllRegistered();
  }
}

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
    this.rootComponent = createRef();
    this.amudimRef = createRef();
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
            ref={this.rootComponent}
            allAmudim={() => this.getAmudim()}
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
    if (this.rootComponent.current === null) {
      setInterval(200, () => this.declareReady());
    } else {
      this.rootComponent.current.setState({isReady: true});
    }
  }

  forceUpdate() {
    if (this.rootComponent.current === null) {
      setInterval(200, () => this.forceUpdate());
    } else {
      this.rootComponent.current.forceUpdate();
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
