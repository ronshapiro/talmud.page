/* global jQuery, $, gtag, componentHandler */
import React, {
  Component,
  createContext,
  createRef,
} from "react";
import {render} from 'react-dom';
import PropTypes from 'prop-types';

const JSX_NOOP = null;

jQuery.fn.extend({
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

const ConfigurationContext = createContext();

const _concat = (...args) => {
  const result = [];
  for (const arg of args) {
    if (arg) result.push(...arg);
  }
  return result;
};

const isEmptyText = (stringOrList) => {
  return !stringOrList || stringOrList === "" || stringOrList.length === 0;
};

const stringOrListToString = (stringOrList) => {
  return typeof stringOrList === "string"
    ? stringOrList
    : stringOrList.join("<br>");
};

const brTagsCache = {};
const brTags = (count) => {
  if (count in brTagsCache) {
    return brTagsCache[count];
  }

  const tags = [];
  for (let i = 0; i < count; i++) {
    tags.push("<br>");
  }
  const result = tags.join("");
  brTagsCache[count] = result;
  return result;
};

class Cell extends Component {
  static propTypes = {
    classes: PropTypes.arrayOf(PropTypes.string).isRequired,
    text: PropTypes.node.isRequired,
  };

  classes(...extraClasses) {
    return _concat(this.props.classes, ["table-cell"], extraClasses).join(" ");
  }

  childrenProp() {
    // TODO: props.text is an awkward name.
    if (typeof this.props.text === "string") {
      return {dangerouslySetInnerHTML: {__html: this.props.text}};
    } else {
      return {children: this.props.text};
    }
  }
}

class HebrewCell extends Cell {
  static contextType = ConfigurationContext;

  ref = createRef();

  render() {
    const {isEnglishExpanded, shouldWrap} = this.props;
    const siblingExpandedClass = this.context.wrapTranslations && isEnglishExpanded && shouldWrap
          ? "siblingExpanded"
          : undefined;
    return (
      <div
        dir="rtl"
        className={this.classes("hebrew", siblingExpandedClass)}
        ref={this.ref}
        {...this.childrenProp()} // eslint-disable-line react/jsx-props-no-spreading
        />
    );
  }

  componentDidMount() {
    $(this.ref.current).betterDoubleClick(this.props.hebrewDoubleClickListener);
    this.forceUpdate(); // to trigger componentDidUpdate();
  }

  componentDidUpdate() {
    if (this.called) {
      return;
    }
    this.called = true;
    const maxLines = Math.floor(
      $(this.ref.current).height() / $(this.props.englishRef.current).height());
    if (maxLines > 1) { // Also checks that maxLines is not NaN
      this.props.updateHebrewLineCount(maxLines.toString());
    }
  }
}

class EnglishCell extends Cell {
  static contextType = ConfigurationContext;

  render() {
    const classes = ["english"];

    const {isEnglishExpanded, englishRef, lineClampLines, shouldWrap} = this.props;

    if (this.context.isFake) {
      classes.push("neverWrap");
    } else if (!isEnglishExpanded) {
      classes.push("lineClamped");
    } else if (this.context.wrapTranslations && shouldWrap) {
      // TODO: if the english cell expanded is only a little bit of extra text (1 line, or 2 short
      // ones, use the default layout and don't wrap.
      classes.push("translationWrapped");
    } else {
      classes.push("neverWrap");
    }

    return (
      <div
        dir="ltr"
        className={this.classes(...classes)}
        ref={englishRef}
        style={{WebkitLineClamp: lineClampLines}}
        {...this.childrenProp()} // eslint-disable-line react/jsx-props-no-spreading
        />
    );
  }

  componentDidMount() {
    $(this.props.englishRef.current).betterDoubleClick(this.props.toggleEnglishExpanded);
  }
}

class TableRow extends Component {
  static propTypes = {
    hebrew: PropTypes.node,
    english: PropTypes.node,
    id: PropTypes.string,
    classes: PropTypes.arrayOf(PropTypes.string),
    hebrewDoubleClickListener: PropTypes.func,
    "sefaria-ref": PropTypes.string,
    overrideFullRow: PropTypes.bool,
    isHiddenRow: PropTypes.bool,
  };

  static contextType = ConfigurationContext;

  constructor(props) {
    super(props);
    this.state = {hebrewLineCount: 1, isEnglishExpanded: this.props.isHiddenRow || false};
    this.englishRef = createRef();
  }

  render() {
    const {
      hebrew,
      english,
      classes,
      hebrewDoubleClickListener,
      id,
    } = this.props;
    const shouldWrap = this.shouldTranslationWrap();

    const cells = [];
    if (!isEmptyText(hebrew)) {
      cells.push(
        <HebrewCell
          key="hebrew"
          text={hebrew}
          classes={this.cellClasses()}
          updateHebrewLineCount={newCount => this.setState({hebrewLineCount: newCount})}
          hebrewDoubleClickListener={hebrewDoubleClickListener}
          isEnglishExpanded={this.state.isEnglishExpanded}
          englishRef={this.englishRef}
          shouldWrap={shouldWrap}
          />);
    }
    if (!isEmptyText(english)) {
      const toggleEnglishExpanded = () => {
        this.setState((previousState) => {
          return {...previousState, isEnglishExpanded: !previousState.isEnglishExpanded};
        });
      };
      cells.push(
        <EnglishCell
          key="english"
          text={english}
          classes={this.cellClasses()}
          englishRef={this.englishRef}
          toggleEnglishExpanded={toggleEnglishExpanded}
          isEnglishExpanded={this.state.isEnglishExpanded}
          lineClampLines={this.state.hebrewLineCount}
          shouldWrap={shouldWrap}
          />);
    }

    return (
      <div
        id={id}
        className={_concat(["table-row"], classes).join(" ")}
        sefaria-ref={this.props["sefaria-ref"]}
        >
        {cells}
      </div>
    );
  }

  cellClasses() {
    const {hebrew, english, overrideFullRow} = this.props;
    if ((isEmptyText(hebrew) || isEmptyText(english)) && !overrideFullRow) {
      return ["fullRow"];
    }
    return [];
  }

  shouldTranslationWrap() {
    if (this.context.isFake || !this.context.wrapTranslations || !this.state.isEnglishExpanded) {
      return false;
    }

    const {hebrew, english} = this.props;
    const hiddenHebrew = $(this.context.hiddenHost).find(".hebrew");
    const hiddenEnglish = $(this.context.hiddenHost).find(".english");
    this.applyHiddenNode(hebrew, hiddenHebrew);
    this.applyHiddenNode(english, hiddenEnglish);
    const totalEnglishLines = this.calculateLineCount(hiddenEnglish);
    this.applyHiddenNode(brTags(totalEnglishLines - 3 /* heuristic */), hiddenEnglish);

    return hiddenHebrew.height() < hiddenEnglish.height();
  }

  applyHiddenNode(contents, node) {
    // estimating size is only doable with html as a string, as calling ReactDOM.render() within a
    // component is unsupported due to its side effects.
    if (typeof contents === "string") {
      node.html(contents);
    } else {
      node.html("");
    }
  }

  calculateLineCount(node) {
    const height = node.height();
    for (let i = 1; true; i++) { // eslint-disable-line no-constant-condition
      node.html(brTags(i));
      const currentHeight = node.height();
      if (currentHeight >= height) {
        return i;
      }
    }
  }
}

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
        classes={["commentaryRow"]}
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

  applyButtonToFocusRef

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


class Section extends Component {
  static propTypes = {
    section: PropTypes.object,
    sectionLabel: PropTypes.string,
  };

  static contextType = ConfigurationContext;

  constructor(props) {
    super(props);
    this.state = {};
  }

  toggleShowing(prependNew, sectionLabel, commentaryName) {
    // TODO: reducer?
    const newState = {...this.state};
    if (!(sectionLabel in newState)) {
      newState[sectionLabel] = [];
    }
    const sectionOrdering = newState[sectionLabel];
    const alreadyIncludes = sectionOrdering.includes(commentaryName);
    if (alreadyIncludes) {
      newState[sectionLabel] = sectionOrdering.filter(x => x !== commentaryName);
    } else if (prependNew) {
      sectionOrdering.unshift(commentaryName);
    } else {
      sectionOrdering.push(commentaryName);
    }
    this.setState(newState);
    return !alreadyIncludes;
  }

  render() {
    const {section, sectionLabel} = this.props;
    const sectionContents = [];
    const hebrewDoubleClickListener = () => {
      if (section.commentary.Translation || section.commentary.Steinsaltz) {
        this.toggleShowing(true, sectionLabel, "translation");
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
        english={this.context.translationOption === "english-side-by-side" ? section.en : undefined}
        classes={gemaraContainerClasses} />);

    if (section.commentary) {
      sectionContents.push(
        <CommentarySection
          key="commentarySection"
          commentaries={section.commentary}
          getOrdering={commentSectionLabel => this.state[commentSectionLabel] || []}
          toggleShowing={(...args) => this.toggleShowing(false, ...args)}
          sectionLabel={sectionLabel} />);
    }

    return (
      <div id={sectionLabel} className="section-container" sefaria-ref={section.ref}>
        {sectionContents}
      </div>
    );
  }
}

class Amud extends Component {
  static propTypes = {
    amudData: PropTypes.object,
  };


  render() {
    const {amudData} = this.props;
    const output = [<h2 key="title">{amudData.title}</h2>];
    if (amudData.loading) {
      output.push(
        <div
          key={`${amudData.id}-loading-spinner`}
          className="text-loading-spinner mdl-spinner mdl-spinner--single-color mdl-js-spinner is-active" />);
    }

    for (let i = 0; i < amudData.sections.length; i++) {
      const section = amudData.sections[i];
      if (i !== 0 && section.steinsaltz_start_of_sugya) {
        output.push(<br key={`sugya-separator-${i}`} className="sugya-separator" />);
      }

      const sectionLabel = `${amudData.id}_section_${i + 1}`;
      output.push(<Section key={i} section={section} sectionLabel={sectionLabel} />);
    }
    return (
      <div id={`amud-${amudData.id}`} className="amudContainer" amud={amudData.id}>
        {output}
      </div>
    );
  }
}

class Amudim extends Component {
  static propTypes = {
    allAmudim: PropTypes.func.isRequired,
    isFake: PropTypes.bool,
  };

  state = {}

  render() {
    const {isFake, allAmudim} = this.props;
    if (!isFake && !this.state.isReady) {
      return [];
    }
    return allAmudim().map(amud => <Amud key={amud.id + "-amud"} amudData={amud} />);
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
  constructor(commentaryTypes, translationOption, wrapTranslations) {
    this._commentaryTypes = commentaryTypes;
    this._translationOption = translationOption;
    this.wrapTranslations = wrapTranslations;
    this.rootComponent = createRef();
    this.allAmudim = {};
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
        commentary: {},
      }],
    }];

    const hiddenContext = {
      ...context,
      translationOption: "english-side-by-side",
      wrapTranslations: false,
      isFake: true,
    };
    render(
      <ConfigurationContext.Provider value={hiddenContext}>
        <Amudim allAmudim={() => hiddenData} isFake />
      </ConfigurationContext.Provider>,
      hiddenHost);

    render(
      <ConfigurationContext.Provider value={context}>
        <Amudim ref={this.rootComponent} allAmudim={() => this.getAmudim()} />
      </ConfigurationContext.Provider>,
      host);
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
  constructor(translationOption, wrapTranslations) {
    super(TalmudRenderer._defaultCommentaryTypes(), translationOption, wrapTranslations);
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
  _concat,
  Renderer,
  TalmudRenderer,
};
