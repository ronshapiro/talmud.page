/* global gtag, componentHandler */
import React, {
  Component,
  createRef,
  useEffect,
  useState,
} from "react";
import {render} from 'react-dom';
import PropTypes from 'prop-types';
import _ from "underscore";
import {v4 as newUuid} from "uuid";
import {addDriveComments} from "./addDriveComments.ts";
import {amudMetadata} from "./amud.ts";
import {CorrectionModal} from "./CorrectionModal.tsx";
import {FeedbackView} from "./Feedback.tsx";
import isEmptyText from "./is_empty_text.ts";
import {$} from "./jquery";
import {LocalStorageInt, LocalStorageLru} from "./localStorage";
import {
  NextButton,
  PreviousButton,
} from "./NavigationButtons.tsx";
import TableRow, {CellText} from "./TableRow.jsx";
import {
  ConfigurationContext,
  useConfiguration,
  HiddenHostContext,
  useHiddenHost,
} from "./context.js";
import {mergeCommentaries} from "./mergeCommentaries.ts";
import {Preferences} from "./Preferences.tsx";

const JSX_NOOP = null;

$.fn.extend({
  betterDoubleClick(fn) {
    if (!!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)) {
      let lastTime = 0;
      this.off("click");
      this.click((event) => {
        const now = Date.now();
        if (now - lastTime <= 1000) {
          fn(event);
          lastTime = 0;
        } else {
          lastTime = now;
        }
      });
    } else {
      this.off("dblclick");
      this.dblclick(fn);
    }
    return this;
  },
});

const stringOrListToString = (stringOrList) => {
  return typeof stringOrList === "string"
    ? stringOrList
    : stringOrList.join("<br>");
};

class CommentRow extends Component {
  static propTypes = {
    comment: PropTypes.object,
    commentaryKind: PropTypes.object,
  };

  static contextType = ConfigurationContext;

  state = {};

  toggleDisplayEnglishSteinsaltzWithHebrew() {
    this.setState(previousState => {
      return {
        ...previousState,
        displayEnglishSteinsaltzWithHebrew: !previousState.displayEnglishSteinsaltzWithHebrew,
      };
    });
  }

  renderTableRow(key, hebrew, english, overrideRef = undefined) {
    const {comment, commentaryKind} = this.props;
    const ref = overrideRef || comment.ref;
    const expandableTranslations = (
      this.context.translationOption() === "both"
        && localStorage.hideGemaraTranslationByDefault === "true"
        && commentaryKind.englishName === "Translation");

    const createRow = (_key, _hebrew, _english) => (
      <TableRow
        key={_key}
        hebrew={_hebrew}
        english={_english}
        sefaria-ref={ref}
        link={comment.link}
        classes={["commentaryRow", /* used in CSS */ commentaryKind.className]}
        expandEnglishByDefault={
          commentaryKind.englishName === "Translation" && this.context.expandEnglishByDefault()
        }
        hebrewDoubleClickListener={
          expandableTranslations
            ? () => this.toggleDisplayEnglishSteinsaltzWithHebrew()
            : undefined
        }
      />
    );
    return (
      <React.Fragment key={key}>
        {createRow("main", hebrew, expandableTranslations ? "" : english)}
        {expandableTranslations && this.state.displayEnglishSteinsaltzWithHebrew
         && createRow("main-translation", "", english)}
      </React.Fragment>
    );
  }

  render() {
    const {comment, commentaryKind} = this.props;

    const output = [];
    if (commentaryKind.showTitle) {
      output.push(
        this.renderTableRow(
          "title",
          <strong>{comment.sourceHeRef}</strong>,
          isEmptyText(comment.en) ? "" : <strong>{comment.sourceRef}</strong>));
      if (comment.subtitle) {
        output.push(
          this.renderTableRow(
            "subtitle",
            <strong>{comment.subtitle.he}</strong>,
            this.context.translationOption() === "just-hebrew" || stringOrListToString(comment.en).length === 0
              ? undefined
              : <strong>{comment.subtitle.en}</strong>));
      }
    }

    if (Array.isArray(comment.he) && Array.isArray(comment.en)
        && comment.he.length === comment.en.length
        // Make sure that if there are nested arrays, the flattened length also matches. This is a
        // lazy-person JaggedArray size check.
        && comment.he.flat(Infinity).length === comment.en.flat(Infinity).length) {
      const hebrew = comment.he.flat(Infinity);
      const english = comment.en.flat(Infinity);
      for (let i = 0; i < hebrew.length; i++) {
        const lineRef = (
          comment.expandedRefsAfterRewriting
            ? comment.expandedRefsAfterRewriting[i]
            : "ignore-drive");
        // TODO: parse the ref and allow it these to be commentable/highlightable
        output.push(this.renderTableRow(i, hebrew[i], english[i], lineRef));
      }
    } else {
      output.push(
        this.renderTableRow(
          "joined comments",
          stringOrListToString(comment.he),
          stringOrListToString(comment.en)));
    }

    return output;
  }
}

function commentaryHighlightColors(commentary, colors) {
  if (!colors) colors = new Set();
  for (const comment of commentary.comments) {
    for (const color of comment.highlightColors || []) {
      colors.add(color);
    }
    Object.values(comment.commentary || {}).forEach(
      nested => commentaryHighlightColors(nested, colors));
  }
  return colors;
}

const MAX_BUTTONS_TO_SHOW_BEFORE_SHOWING_MORE = 7;
const DEBUG_EXPAND_ALL_COMMENTARIES_BY_DEFAULT = false;

class CommentarySection extends Component {
  static propTypes = {
    commentaries: PropTypes.object,
    getOrdering: PropTypes.func,
    toggleShowing: PropTypes.func,
    sectionLabel: PropTypes.string,
  };

  static contextType = ConfigurationContext;

  state = {};

  render() {
    const {commentaries, getOrdering, toggleShowing, sectionLabel} = this.props;
    if (!commentaries || Object.keys(commentaries).length === 0) {
      return JSX_NOOP;
    }

    const output = [];
    for (const commentaryClassName of getOrdering(sectionLabel)) {
      const commentaryKind = this.context.commentaryTypesByClassName[commentaryClassName];
      let commentary = commentaries[commentaryKind.englishName];
      if (!commentary) {
        // TODO: investigate a better solution for the indexByClassName overlapping for Translation
        // and Steinsaltz (it appears when side-by-side is used)
        if (commentaryClassName === "translation") {
          commentary = commentaries.Steinsaltz;
        }
        if (!commentary) {
          // This can happen when deleting the last personal note in a segment, as the delete
          // happens outside of the normal JS flow.
          if (commentaryClassName === "personal-notes") continue;

          throw new Error(
            `Could not find ${commentaryClassName} commentary in ${sectionLabel}
            ${Object.keys(commentaries).join(", ")}`);
        }
      }
      output.push(
        this.renderTableRow(
          commentaryKind.englishName,
          this.renderButton(commentaryKind, true, commentary),
          ""));
      // This set is particulary useful for merged segments, where duplicates are more common.
      const seen = new Set();
      commentary.comments.forEach(comment => {
        if (!seen.has(comment.ref)) {
          seen.add(comment.ref);
          output.push(
            <CommentRow
              key={comment.ref}
              comment={comment}
              commentaryKind={commentaryKind}
              />);
        }
        if (comment.commentary) {
          const nestedSectionLabel = `${sectionLabel}.<nested>.${comment.ref}`;
          output.push(
            <CommentarySection
              commentaries={comment.commentary}
              getOrdering={getOrdering}
              toggleShowing={toggleShowing}
              sectionLabel={nestedSectionLabel}
              key={nestedSectionLabel}
            />);
        }
      });
    }

    output.push(this.renderShowButtons());
    return output;
  }

  renderTableRow(key, hebrew, english, extraClasses = []) {
    const overrideFullRow = this.context.translationOption() === "english-side-by-side";
    return (
      <TableRow
        key={key}
        hebrew={hebrew}
        english={english}
        overrideFullRow={overrideFullRow}
        classes={["commentaryRow"].concat(extraClasses)}
        />
    );
  }

  forEachCommentary(commentaries, action) {
    for (const commentaryKind of this.context.commentaryTypes) {
      const commentary = commentaries[commentaryKind.englishName];
      if (commentary) {
        action(commentary, commentaryKind);
      }
    }
  }

  renderShowButtons() {
    const {commentaries, getOrdering, sectionLabel} = this.props;
    const commentariesToShow = [];
    this.forEachCommentary(commentaries, (commentary, commentaryKind) => {
      if (!getOrdering(sectionLabel).includes(commentaryKind.className)) {
        commentariesToShow.push([commentary, commentaryKind]);
      }
    });

    const buttons = [];
    let wouldAnyButtonBeHidden = false;
    for (const [commentary, commentaryKind] of commentariesToShow) {
      const wouldThisButtonBeHidden = (
        buttons.length > MAX_BUTTONS_TO_SHOW_BEFORE_SHOWING_MORE
          && commentariesToShow.length > (MAX_BUTTONS_TO_SHOW_BEFORE_SHOWING_MORE + 2)
          && commentaryKind.className !== "personal-notes"
          && commentaryHighlightColors(commentary).size === 0);
      wouldAnyButtonBeHidden = wouldAnyButtonBeHidden || wouldThisButtonBeHidden;
      if (this.state.showAll || !wouldThisButtonBeHidden) {
        buttons.push(this.renderButton(commentaryKind, false, commentary));
      }
    }

    if (wouldAnyButtonBeHidden) {
      buttons.push(this.renderButton(this.showMoreCommentaryKind(), false, {comments: []}));
    }

    return this.renderTableRow(`${sectionLabel} show buttons`, buttons, "", ["show-buttons"]);
  }

  buttonToFocusAfterEnter = createRef();

  renderButton(commentaryKind, isShowing, commentary) {
    const {toggleShowing, sectionLabel} = this.props;

    if (localStorage.showTranslationButton !== "yes"
        && commentaryKind.className === "translation") {
      return JSX_NOOP;
    }

    const onClick = () => {
      if (commentaryKind.className === "show-more") {
        this.setState(previousState => {
          return {...previousState, showAll: !previousState.showAll};
        });
        return;
      }
      const newValue = toggleShowing(sectionLabel, commentaryKind.className);
      gtag("event", newValue ? "commentary_viewed" : "commentary_hidden", {
        commentary: commentaryKind.englishName,
        section: sectionLabel,
      });
    };
    const onKeyUp = event => {
      if (event && event.code === "Enter") {
        onClick();
        this.setState(previousState => {
          return {...previousState, buttonToFocus: commentaryKind};
        });
      }
    };
    const applyButtonToFocusRef = (element) => {
      if (this.state.buttonToFocus === commentaryKind) {
        element.ref = this.buttonToFocusAfterEnter;
      }
      return element;
    };

    const button = applyButtonToFocusRef(
      // eslint-disable-next-line jsx-a11y/anchor-is-valid
      <a
        key="button"
        className={this.buttonClasses(commentaryKind, isShowing, commentary)}
        role="button"
        tabIndex="0"
        onClick={onClick}
        onKeyUp={onKeyUp}>
        {commentaryKind.hebrewName}
      </a>);
    return (
      // Wrap in a span so that the commentary colors don't get their own flex spacing separate from
      // the button.
      <span key={commentaryKind.englishName}>
        {button}
        {!isShowing && Array.from(commentaryHighlightColors(commentary)).map(
          color => (
            <span
              key={commentaryKind.englishName + color}
              className={`highlighted-commentary-indicator-${color}`}>
              ●
            </span>
          ),
        )}
      </span>
    );
  }

  hasNestedPersonalComments(commentary) {
    for (const comment of commentary.comments || []) {
      if (!comment.commentary) continue;
      if (comment.commentary["Personal Notes"]) return true;
      for (const nestedCommentary of Object.values(comment.commentary)) {
        if (this.hasNestedPersonalComments(nestedCommentary)) {
          return true;
        }
      }
    }
    return false;
  }

  buttonClasses(commentaryKind, isShowing, commentary) {
    return [
      "commentary_header",
      commentaryKind.className,
      commentaryKind.cssCategory,
      !isShowing && this.hasNestedPersonalComments(commentary)
        ? "has-nested-commentaries"
        : undefined,
    ].filter(x => x).join(" ");
  }

  componentDidUpdate() {
    if (this.state.buttonToFocus) {
      this.buttonToFocusAfterEnter.current.focus();
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState(previousState => {
        return {...previousState, buttonToFocus: undefined};
      });
    }
  }

  showMoreCommentaryKind() {
    return this.state.showAll
      ? {englishName: "Hide", hebrewName: "פחות", className: "show-more"}
      : {englishName: "More", hebrewName: "עוד", className: "show-more"};
  }

  componentDidMount() {
    if (DEBUG_EXPAND_ALL_COMMENTARIES_BY_DEFAULT) {
      setTimeout(() => {
        const {commentaries, toggleShowing, sectionLabel} = this.props;
        for (const commentaryKind of this.context.commentaryTypes) {
          if (commentaryKind.englishName in commentaries) {
            toggleShowing(sectionLabel, commentaryKind.className);
          }
        }
      }, 100);
    }
  }
}

function Section({sections, sectionLabel, toggleMerging, isExpanded}) {
  const context = useConfiguration();
  const hiddenHost = useHiddenHost();
  // if this is the hidden host, populate the comments as open always
  const [showingState, setShowingState] = useState(() => {
    const state = {};
    if (isExpanded && context.expandTranslationOnMergedSectionExpansion) {
      state[sectionLabel] = ["translation"];
    }
    if (hiddenHost) {
      return state;
    }
    state[sectionLabel] = ["rashi"];
    return state;
  });
  const toggleShowing = (prependNew, toggledSectionLabel, commentaryName) => {
    // TODO: reducer?
    let alreadyIncludes;
    setShowingState(previousState => {
      const newState = {...previousState};

      if (!(toggledSectionLabel in newState)) {
        newState[toggledSectionLabel] = [];
      }
      const sectionOrdering = newState[toggledSectionLabel];
      alreadyIncludes = sectionOrdering.includes(commentaryName);
      if (alreadyIncludes) {
        newState[toggledSectionLabel] = sectionOrdering.filter(x => x !== commentaryName);
      } else if (prependNew) {
        sectionOrdering.unshift(commentaryName);
      } else {
        sectionOrdering.push(commentaryName);
      }
      return newState;
    });

    return !alreadyIncludes;
  };

  const sectionContents = [];
  const hebrewDoubleClickListener = () => {
    for (const section of sections) {
      if (section.commentary.Translation || section.commentary.Steinsaltz) {
        toggleShowing(true, sectionLabel, "translation");
        break;
      }
    }
  };

  const gemaraContainerClasses = ["gemara-container"];
  for (const section of sections) {
    if (section.hadran) {
      gemaraContainerClasses.push("hadran");
      break;
    }
  }

  const hebrews = [];
  const englishes = [];
  for (const section of sections) {
    hebrews.push(section.he);
    if (context.translationOption() === "english-side-by-side") {
      englishes.push(section.en);
    }
  }

  const createText = (texts, languageClass) => {
    if (texts.length === 0) {
      return "";
    }
    const elements = [];
    for (let i = 0; i < texts.length; i++) {
      const {ref, uuid} = sections[i];
      const onDoubleClick = texts.length !== 1 ? () => toggleMerging(uuid) : undefined;
      elements.push(
        // TODO: consider another gesture so that the double clicking is not overloaded.
        <CellText
          text={texts[i]}
          languageClass={languageClass}
          key={`section-part-${i}`}
          onDoubleClick={onDoubleClick}
          sefariaRef={ref} />);
      if (i + 1 < texts.length) {
        elements.push(<span key={`section-part-${i}-space`}> </span>);
      }
    }
    return <span>{elements}</span>;
  };

  sectionContents.push(
    <TableRow
      key="gemara"
      id={`${sectionLabel}-gemara`}
      hebrew={createText(hebrews, "hebrew-ref-text")}
      hebrewDoubleClickListener={hebrews.length === 1 ? hebrewDoubleClickListener : undefined}
      english={createText(englishes, "english-ref-text")}
      expandEnglishByDefault={context.expandEnglishByDefault()}
      classes={gemaraContainerClasses}
      indicator={isExpanded}
      onUnexpand={isExpanded ? () => toggleMerging(sections[0].uuid) : undefined}
      sectionIdForHighlighting={sections[0].ref}
    />,
  );

  const commentary = mergeCommentaries(sections);
  if (commentary) {
    const commentarySection = (
      <CommentarySection
        key="commentarySection"
        commentaries={commentary}
        getOrdering={commentSectionLabel => showingState[commentSectionLabel] || []}
        toggleShowing={(...args) => toggleShowing(false, ...args)}
        sectionLabel={sectionLabel} />
    );


    if (hiddenHost) {
      // hiddenHost will be undefined for the section inside the actual hidden host
      sectionContents.push(
        <HiddenHostContext.Provider value={hiddenHost.forComments} key="commentarySection">
          {[commentarySection]}
        </HiddenHostContext.Provider>);
    } else {
      sectionContents.push(commentarySection);
    }
  }

  return (
    // The sefaria-ref here is used for determining what the "parent" of the selected ref is, so for
    // the case of a commentary, the comment can be placed accordingly in the Google doc. If
    // `sections` has more than 1 element, the ref that is used could be the first ref or the last
    // ref. The last seems more logical, since the ordering of comments from merged sections should
    // be placed after every containing ref. But this isn't absolute and could result in some
    // weirdness.
    <div id={sectionLabel} className="section-container" sefaria-ref={sections.slice(-1)[0].ref}>
      {sectionContents}
    </div>
  );
}

Section.propTypes = {
  sections: PropTypes.arrayOf(PropTypes.object),
  sectionLabel: PropTypes.string,
  toggleMerging: PropTypes.func,
  isExpanded: PropTypes.bool,
};

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
    // the texts instead of computing them on the client.
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
        <span className={className} key="title" ref={this.headerRef}>{title}</span>
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
      const ignoredRefs = new Set(this.context.ignoredSectionRefs());
      const sections = amudData.sections.filter(x => !ignoredRefs.has(x.ref));
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];

        const makeSeparator = () => <br key={`separator-${i}`} className="section-separator" />;
        if (i !== 0 && section.steinsaltz_start_of_sugya) {
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
          if (nextSection && this.state.expandMergedRef[nextSection.uuid]) break;
          if (nextSection && nextSection.steinsaltz_start_of_sugya) break;
          if (nextSection && nextSection.hadran) break;
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
            };
            newState.expandMergedRef[uuid] = !newState.expandMergedRef[uuid];
            return newState;
          });
        };
        output.push(
          <Section
            key={mergedSections[0].uuid + "+" + (mergedSections.length - 1)}
            sections={mergedSections}
            sectionLabel={sectionLabel}
            toggleMerging={toggleMerging}
            isExpanded={this.state.expandMergedRef[mergedSections[0].uuid]}
            />);
        if (i < sections.length - 1 && mergedSections.slice(-1)[0].lastSegmentOfSection) {
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
  });
  return null;
}

class Root extends Component {
  static propTypes = {
    allAmudim: PropTypes.func.isRequired,
    isFake: PropTypes.bool,
    navigationExtension: PropTypes.object.isRequired,
  };

  state = {}

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
    return (
      <>
        <PreviousButton navigationExtension={navigationExtension} />
        {amudim}
        <NextButton navigationExtension={navigationExtension} />
        <Preferences rerender={() => this.forceUpdate()} />
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

  ignoredSectionRefs() {
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
      ignoredSectionRefs: () => this.ignoredSectionRefs(),
      expandTranslationOnMergedSectionExpansion: this.expandTranslationOnMergedSectionExpansion,
      compactLayout: () => this.allowCompactLayout && localStorage.layoutOption === "compact",
      highlightedIds: new LocalStorageLru(
        "highlightedIds",
        // 100 seems like enough to make sure that we don't save too much data, but also don't have
        // to worry about needing to re-render. This isn't "state", so theoretically when something
        // gets booted from the cache, it won't be actually removed here, but if there is a full
        // re-render or refresh, the state could change. That seems probably safe.
        100),
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
}
