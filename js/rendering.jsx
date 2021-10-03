/* global gtag, componentHandler */
import React, {
  Component,
  createRef,
  useState,
} from "react";
import {render} from 'react-dom';
import PropTypes from 'prop-types';
import _ from "underscore";
import {addDriveComments} from "./addDriveComments.ts";
import {amudMetadata} from "./amud.ts";
import {getCommentaryTypes} from "./commentaryTypes.ts";
import {CorrectionModal} from "./CorrectionModal.tsx";
import isEmptyText from "./is_empty_text.ts";
import {$} from "./jquery";
import {
  NextButton,
  PreviousButton,
} from "./NavigationButtons.tsx";
import TableRow from "./TableRow.jsx";
import {
  ConfigurationContext,
  useConfiguration,
  HiddenHostContext,
  useHiddenHost,
} from "./context.js";

const JSX_NOOP = null;

$.fn.extend({
  betterDoubleClick(fn) {
    if (!!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)) {
      let lastTime = 0;
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

// https://github.com/Sefaria/Sefaria-Project/issues/541
const isSefariaReturningLongListsOfSingleCharacters = (comment) => {
  if (!Array.isArray(comment.he) || !Array.isArray(comment.en)) {
    return false;
  }
  const reducer = (numberOfSingleCharacters, x) => (
    numberOfSingleCharacters + ((x.length === 1) ? 1 : 0));
  // 3 is a guess of a reasonable minimum for detecting that this is a bug
  return comment.he.reduce(reducer, 0) > 3 && comment.en.reduce(reducer, 0) > 3;
};

class CommentRow extends Component {
  static propTypes = {
    comment: PropTypes.object,
    commentaryKind: PropTypes.object,
  };

  static contextType = ConfigurationContext;

  renderTableRow(key, hebrew, english, overrideRef = undefined) {
    const {comment, commentaryKind} = this.props;
    const ref = (
      commentaryKind.englishName === "Personal Notes"
        ? "ignore"
        : overrideRef || comment.ref);
    return (
      <TableRow
        key={key}
        hebrew={hebrew}
        english={english}
        sefaria-ref={ref}
        link={comment.link}
        classes={["commentaryRow", /* used in CSS */ commentaryKind.className]}
        expandEnglishByDefault={
          commentaryKind.englishName === "Translation" && this.context.expandEnglishByDefault
        }
        />
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
            this.context.translationOption === "just-hebrew" || stringOrListToString(comment.en).length === 0
              ? undefined
              : <strong>{comment.subtitle.en}</strong>));
      }
    }

    if (Array.isArray(comment.he) && Array.isArray(comment.en)
        && comment.he.length === comment.en.length) {
      for (let i = 0; i < comment.he.length; i++) {
        // TODO: parse the ref and allow it these to be commentable/highlightable
        output.push(this.renderTableRow(i, comment.he[i], comment.en[i], "ignore-drive"));
      }
    } else if (isSefariaReturningLongListsOfSingleCharacters(comment)) {
      output.push(this.renderTableRow("joined comments", comment.he.join(""), comment.en.join("")));
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
  }
  Object.values(commentary.commentary || {}).forEach(
    nested => commentaryHighlightColors(nested, colors));
  return colors;
}

const MAX_BUTTONS_TO_SHOW_BEFORE_SHOWING_MORE = 7;

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
          throw new Error(`Could not find ${commentaryClassName} commentary in ${sectionLabel}`);
        }
      }
      output.push(
        this.renderTableRow(
          commentaryKind.englishName,
          this.renderButton(commentaryKind, true, commentary),
          ""));
      commentary.comments.forEach(comment => {
        output.push(
          <CommentRow
            key={comment.ref}
            comment={comment}
            commentaryKind={commentaryKind}
            />);
      });

      if (commentary.commentary) {
        const nestedSectionLabel = `${sectionLabel}.<nested>.${commentaryKind.className}`;
        output.push(
          <CommentarySection
            commentaries={commentary.commentary}
            getOrdering={getOrdering}
            toggleShowing={toggleShowing}
            sectionLabel={nestedSectionLabel}
            key={nestedSectionLabel}
            />);
      }
    }

    output.push(this.renderShowButtons());
    return output;
  }

  renderTableRow(key, hebrew, english, extraClasses = []) {
    const overrideFullRow = this.context.translationOption === "english-side-by-side";
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
          && commentaryKind.className !== "personal-notes");
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

  buttonClasses(commentaryKind, isShowing, commentary) {
    return [
      "commentary_header",
      commentaryKind.className,
      commentaryKind.cssCategory,
      !isShowing && commentary.commentary && commentary.commentary["Personal Notes"]
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
}

function Section(props) {
  const {section, sectionLabel} = props;
  const context = useConfiguration();
  const hiddenHost = useHiddenHost();
  // if this is the hidden host, populate the comments as open always
  const [showingState, setShowingState] = useState(() => {
    if (hiddenHost) {
      return {};
    }
    const fakeState = {};
    fakeState[sectionLabel] = ["rashi"];
    return fakeState;
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
    if (section.commentary.Translation || section.commentary.Steinsaltz) {
      toggleShowing(true, sectionLabel, "translation");
    }
  };

  const gemaraContainerClasses = ["gemara-container"];
  if (section.hadran) {
    gemaraContainerClasses.push("hadran");
  }

  sectionContents.push(
    <TableRow
      key="gemara"
      id={`${sectionLabel}-gemara`}
      hebrew={section.he}
      hebrewDoubleClickListener={hebrewDoubleClickListener}
      english={context.translationOption === "english-side-by-side" ? section.en : undefined}
      expandEnglishByDefault={context.expandEnglishByDefault}
      classes={gemaraContainerClasses} />);

  if (section.commentary) {
    const commentarySection = (
      <CommentarySection
        key="commentarySection"
        commentaries={section.commentary}
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
    <div id={sectionLabel} className="section-container" sefaria-ref={section.ref}>
      {sectionContents}
    </div>
  );
}

Section.propTypes = {
  section: PropTypes.object,
  sectionLabel: PropTypes.string,
};

class Amud extends Component {
  static propTypes = {
    amudData: PropTypes.object,
  };

  static contextType = ConfigurationContext;

  headerRef = createRef();

  state = {
    showing: true,
  };

  render() {
    const {amudData} = this.props;
    const output = [];
    if (amudData.title) { // only in the case of the hidden host
      output.push(<h2 key="title" ref={this.headerRef}>{amudData.title}</h2>);
    }
    if (amudData.loading) {
      output.push(
        <div
          key={`${amudData.id}-loading-spinner`}
          className="text-loading-spinner mdl-spinner mdl-spinner--single-color mdl-js-spinner is-active" />);
    }

    // TODO: if not showing, update the UI so it's clear that it's collapsed
    if (this.state.showing) {
      for (let i = 0; i < amudData.sections.length; i++) {
        const section = amudData.sections[i];
        if (this.context.ignoredSectionRefs().includes(section.ref)) {
          continue;
        }

        if (i !== 0 && section.steinsaltz_start_of_sugya) {
          output.push(<br key={`sugya-separator-${i}`} className="sugya-separator" />);
        }

        const sectionLabel = `${amudData.id}_section_${i + 1}`;
        output.push(<Section key={i} section={section} sectionLabel={sectionLabel} />);
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

    const amudim = allAmudim().map(amud => <Amud key={amud.id + "-amud"} amudData={amud} />);
    return (
      <>
        <PreviousButton navigationExtension={navigationExtension} />
        {amudim}
        <NextButton navigationExtension={navigationExtension} />
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
  constructor(
    commentaryTypes,
    isTalmud,
    translationOption,
    wrapTranslations,
    expandEnglishByDefault,
    navigationExtension) {
    this._commentaryTypes = commentaryTypes;
    this._isTalmud = isTalmud;
    this._translationOption = translationOption;
    this.wrapTranslations = wrapTranslations;
    this.expandEnglishByDefault = expandEnglishByDefault;
    this.rootComponent = createRef();
    this.amudimRef = createRef();
    this.allAmudim = {};
    this.navigationExtension = navigationExtension || {
      hasPrevious: () => false,
      hasNext: () => false,
    };
  }

  _applyClientSideDataTransformations(amudData) {
    if (!amudData.sections) {
      amudData.sections = [];
    }

    if (this._translationOption === "both") {
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
      translationOption: "english-side-by-side",
      wrapTranslations: false,
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
  }

  setAmud(amudData) {
    this.allAmudim[amudData.id] = amudData;
    this.forceUpdate();
  }

  declareReady() {
    this.rootComponent.current.setState({isReady: true});
  }

  forceUpdate() {
    this.rootComponent.current.forceUpdate();
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
    throw new Error("Not implemented!");
  }

  newPageTitle(section) {
    const metadata = amudMetadata();
    return `${metadata.masechet} ${section}`;
  }
}

export class TalmudRenderer extends Renderer {
  constructor(translationOption, wrapTranslations, expandEnglishByDefault, navigationExtension) {
    super(
      getCommentaryTypes("talmud"),
      true,
      translationOption,
      wrapTranslations,
      expandEnglishByDefault,
      navigationExtension);
  }

  sortedAmudim() {
    const keys = Object.keys(this.allAmudim);
    keys.sort((first, second) => {
      const difference = parseInt(first) - parseInt(second);
      if (difference !== 0) {
        return difference;
      }
      return first < second ? -1 : 1;
    });

    return keys.map(key => this.allAmudim[key]);
  }
}
