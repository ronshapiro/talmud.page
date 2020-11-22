/* global $, gtag, componentHandler */
import React, {
  Component,
  createRef,
  useState,
} from "react";
import {render} from 'react-dom';
import PropTypes from 'prop-types';
import _ from "underscore";
import isEmptyText from "./is_empty_text.js";
import {
  NextButton,
  PreviousButton,
} from "./NavigationButtons.jsx";
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
        const now = new Date().getTime();
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

  renderTableRow(key, hebrew, english) {
    const {comment, commentaryKind} = this.props;
    return (
      <TableRow
        key={key}
        hebrew={hebrew}
        english={english}
        sefaria-ref={commentaryKind.englishName === "Personal Notes" ? "ignore" : comment.ref}
        classes={["commentaryRow", /* used in CSS */ commentaryKind.className]}
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
    }

    if (Array.isArray(comment.he) && Array.isArray(comment.en)
        && comment.he.length === comment.en.length) {
      for (let i = 0; i < comment.he.length; i++) {
        output.push(this.renderTableRow(i, comment.he[i], comment.en[i]));
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
      output.push(this.renderTableRow(
        commentaryKind.englishName,
        this.renderButton(commentaryKind), ""));
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

  renderTableRow(key, hebrew, english) {
    const overrideFullRow = this.context.translationOption === "english-side-by-side";
    return (
      <TableRow
        key={key}
        hebrew={hebrew}
        english={english}
        overrideFullRow={overrideFullRow}
        classes={["commentaryRow"]}
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
    const buttons = [];
    this.forEachCommentary(commentaries, (commentary, commentaryKind) => {
      if (!getOrdering(sectionLabel).includes(commentaryKind.className)) {
        buttons.push(this.renderButton(commentaryKind));
      }
    });
    return this.renderTableRow(`${sectionLabel} show buttons`, buttons, "");
  }

  buttonToFocusAfterEnter = createRef();

  renderButton(commentaryKind) {
    const {toggleShowing, sectionLabel} = this.props;

    if (localStorage.showTranslationButton !== "yes"
        && commentaryKind.className === "translation") {
      return JSX_NOOP;
    }

    const onClick = () => {
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

    return applyButtonToFocusRef(
      <a
        key={commentaryKind.englishName}
        className={this.buttonClasses(commentaryKind)}
        tabIndex="0"
        onClick={onClick}
        onKeyUp={onKeyUp}>
        {commentaryKind.hebrewName}
      </a>);
  }

  buttonClasses(commentaryKind) {
    return [
      "commentary_header",
      commentaryKind.className,
      commentaryKind.cssCategory,
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

class Renderer {
  constructor(
    commentaryTypes,
    translationOption,
    wrapTranslations,
    navigationExtension) {
    this._commentaryTypes = commentaryTypes;
    this._translationOption = translationOption;
    this.wrapTranslations = wrapTranslations;
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
          commentaries.Translation = commentaries.Steinsaltz;
          commentaries.Translation.comments[0].en = section.en;
          delete commentaries.Steinsaltz;
        }
      }
    }
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
      hiddenHost,
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
        </HiddenHostContext.Provider>
      </ConfigurationContext.Provider>,
      host);

    $(window).resize(_.throttle(() => this.forceUpdate(), 500));
  }

  setAmud(amudData) {
    this._applyClientSideDataTransformations(amudData);
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
    const amudim = this.sortedAmudim();
    if (!this.driveClient) {
      return amudim;
    }

    const setPersonalComments = (object, personalNotes) => {
      if (personalNotes) {
        if (!object.commentary) object.commentary = {};
        object.commentary["Personal Notes"] = personalNotes;
      } else if (object.commentary) {
        delete object.commentary["Personal Notes"];
      }
    };

    for (const section of amudim.flatMap(amud => amud.sections)) {
      for (const commentaryType of Object.keys(section.commentary || {})) {
        const commentary = section.commentary[commentaryType];
        for (const nestedCommentaryType of Object.keys(commentary.commentary || {})) {
          const nestedCommentary = commentary.commentary[nestedCommentaryType];
          setPersonalComments(
            nestedCommentary,
            this.personalCommentsForRefs(nestedCommentary.comments.map(comment => comment.ref)));
        }
        setPersonalComments(
          commentary,
          this.personalCommentsForRefs(commentary.comments.map(comment => comment.ref)));
      }
      setPersonalComments(section, this.driveClient.commentsForRef(section.ref));
    }

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
}

class TalmudRenderer extends Renderer {
  constructor(translationOption, wrapTranslations, navigationExtension) {
    super(
      TalmudRenderer._defaultCommentaryTypes(),
      translationOption,
      wrapTranslations,
      navigationExtension);
  }

  static _defaultCommentaryTypes() {
    const commentaryTypes = [
      {
        englishName: "Translation",
        hebrewName: "Translation",
        className: "translation",
      },
      {
        englishName: "Verses",
        hebrewName: 'תנ״ך',
        className: "psukim",
        showTitle: true,
      },
      {
        englishName: "Mishnah",
        hebrewName: "משנה",
        className: "mishna",
        showTitle: true,
      },
      {
        englishName: "Tosefta",
        hebrewName: "תוספתא",
        className: "tosefta",
        showTitle: true,
      },
      {
        englishName: "Rashi",
        hebrewName: 'רש"י',
        className: "rashi",
      },
      {
        englishName: "Tosafot",
        hebrewName: "תוספות",
        className: "tosafot",
      },
      {
        englishName: "Rabbeinu Chananel",
        hebrewName: 'ר"ח',
        className: "rabbeinu-chananel",
      },
      {
        englishName: "Ramban",
        hebrewName: 'רמב״ן',
        className: "ramban",
      },
      {
        englishName: "Rashba",
        hebrewName: 'רשב״א',
        className: "rashba",
      },
      {
        englishName: "Rashbam",
        hebrewName: 'רשב״ם',
        className: "rashbam",
      },
      {
        englishName: "Maharsha",
        hebrewName: 'מהרש"א',
        className: "maharsha",
      },
      {
        englishName: "Maharshal",
        hebrewName: 'מהרש"ל',
        className: "maharshal",
      },
      {
        englishName: "Meir Lublin",
        hebrewName: 'מהר"ם לובלין',
        className: "meir-lublin",
      },
      {
        englishName: "Rosh",
        hebrewName: 'רא"ש',
        className: "rosh",
      },
      {
        englishName: "Ritva",
        hebrewName: 'ריטב"א',
        className: "ritva",
      },
      {
        englishName: "Rav Nissim Gaon",
        hebrewName: "רבנו נסים",
        className: "rav-nissim-gaon",
      },
      {
        englishName: "Shulchan Arukh",
        hebrewName: "שולחן ערוך",
        className: "shulchan-arukh",
        cssCategory: "ein-mishpat",
        showTitle: true,
      },
      {
        englishName: "Mishneh Torah",
        hebrewName: "משנה תורה",
        className: "mishneh-torah",
        cssCategory: "ein-mishpat",
        showTitle: true,
      },
      {
        englishName: "Mesorat Hashas",
        type: "mesorat hashas",
        hebrewName: 'מסורת הש״ס',
        className: "mesorat-hashas",
        showTitle: true,
      },
      {
        englishName: "Jastrow",
        hebrewName: "Jastrow",
        className: "jastrow",
      },
    ];

    const steinsaltz = {
      englishName: "Steinsaltz",
      hebrewName: "שטיינזלץ",
      className: "translation",
    };

    if (localStorage.showTranslationButton === "yes") {
      commentaryTypes.push(steinsaltz);
    } else {
      commentaryTypes.unshift(steinsaltz);
    }

    commentaryTypes.push({
      englishName: "Personal Notes",
      hebrewName: "Personal Notes",
      className: "personal-notes",
    });

    return commentaryTypes;
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

module.exports = {
  Renderer,
  TalmudRenderer,
};
