import {onceDocumentReady} from "./once_document_ready.js";
import {Component, render, h, createContext, createRef} from "preact";
import {useState, useContext} from 'preact/hooks';

// TODO(react): add keys wherever seems necesary

jQuery.fn.extend({
  betterDoubleClick: function(fn) {
    if (!!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)) {
      this.click(function(event) {
        let lastTime = this.lastTime || 0;
        const now = new Date().getTime();
        if (now - lastTime <= 1000) {
          fn(event);
          this.lastTime = 0;
        } else {
          this.lastTime = now;
        }
      });
    } else {
      this.dblclick(fn);
    }
    return this;
  }
});
const applyDoubleClick = (element, fn) => {
  // TODO(react): remove jQuery
  $(element).betterDoubleClick(fn);
};

const ConfigurationContext = createContext();
const context = {
  translationOption: () => useContext(ConfigurationContext).translationOption,
  commentaryTypes: () => useContext(ConfigurationContext).commentaryTypes,
  commentaryTypesByClassName: () => useContext(ConfigurationContext).commentaryTypesByClassName,
}

const _concat = function() {
  const result = [];
  for (const arg of arguments) {
    if (arg) result.push(...arg);
  }
  return result;
}

const isEmptyText = (stringOrList)  => {
  return !stringOrList || stringOrList === "" || stringOrList.length == 0;
}

const stringOrListToString = (stringOrList) => {
  return typeof stringOrList === "string"
    ? stringOrList
    : stringOrList.join("<br>");
}

class Cell extends Component {
  defaultClasses = [];

  classes() {
    return _concat(this.props.classes, ["table-cell"], this.defaultClasses).join(" ");
  }

  // TODO: props.text is an awkward name.
  applyChildrenUnsafely(element) {
    if (typeof this.props.text === "string") {
      element.props.dangerouslySetInnerHTML = {__html: this.props.text};
    } else {
      element.props.children = this.props.text;
    }
    return element;
  }
}

class HebrewCell extends Cell {
  defaultClasses = ["hebrew"];
  ref = createRef();

  render() {
    return this.applyChildrenUnsafely(
      <div dir="rtl" class={this.classes()} ref={this.ref} />
    );
  }

  componentDidMount() {
    applyDoubleClick(this.ref.current, this.props.hebrewDoubleClickListener);
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
  defaultClasses = ["english"];
  state = {
    lineClamped: true,
  };

  render() {
    // TODO: attempt to remove english-div
    const innerClasses = ["english-div"];
    if (this.state.lineClamped) {
      innerClasses.push("line-clampable");
    }
    return (
      <div dir="ltr" class={this.classes()} ref={this.props.englishRef}>
        {this.applyChildrenUnsafely(
          <div class={innerClasses.join(" ")}
               style={`-webkit-line-clamp: ${this.props.lineClampLines};`} />)}
      </div>);
  }

  componentDidMount() {
    applyDoubleClick(
      this.props.englishRef.current,
      () => this.setState({lineClamped: !this.state.lineClamped}));
  }
}

class TableRow extends Component{
  state = {hebrewLineCount: 1}
  englishRef = createRef();

  render() {
    const classes = _concat(["table-row"], this.props.classes).join(" ");
    const {hebrew, english, hebrewDoubleClickListener} = this.props;

    const cells = [];
    if (!isEmptyText(hebrew)) {
      cells.push(
        <HebrewCell
          text={hebrew}
          classes={this.cellClasses()}
          updateHebrewLineCount={newCount => this.setState({hebrewLineCount: newCount})}
          hebrewDoubleClickListener={hebrewDoubleClickListener}
          englishRef={this.englishRef}
          />);
    }
    if (!isEmptyText(english)) {
      cells.push(
        <EnglishCell
          text={english}
          classes={this.cellClasses()}
          englishRef={this.englishRef}
          lineClampLines={this.state.hebrewLineCount}
          />);
    }

    const output = <div classes={classes}>{cells}</div>;
    output.props["sefaria-ref"] = this.props["sefaria-ref"];
    return output;
  }

  cellClasses() {
    const {hebrew, english, overrideFullRow} = this.props;
    if ((isEmptyText(hebrew) || isEmptyText(english)) && !overrideFullRow) {
      return ["fullRow"];
    }
    return [];
  }
}

class CommentRow extends Component {
  renderTableRow(hebrew, english) {
    const {comment, commentaryKind} = this.props;
    return (
      <TableRow
        hebrew={hebrew}
        english={english}
        sefaria-ref={comment.ref}
        commentary-kind={commentaryKind.englishName}
        />);
  }

  render() {
    const {comment, commentaryKind} = this.props;

    const output = [];
    if (commentaryKind.showTitle) {
      output.push(
        this.renderTableRow(
          <strong>{comment.sourceHeRef}</strong>,
          isEmptyText(comment.en) ? "" : <strong>{comment.sourceRef}</strong>));
    }

    if (Array.isArray(comment.he) && Array.isArray(comment.en)
        && comment.he.length === comment.en.length) {
      for (let i = 0; i < comment.he.length; i++) {
        output.push(this.renderTableRow(comment.he[i], comment.en[i]));
      }
    } else if (isSefariaReturningLongListsOfSingleCharacters(comment)) {
      output.push(this.renderTableRow(comment.he.join(""), comment.en.join("")));
    } else {
      output.push(
        this.renderTableRow(
          stringOrListToString(comment.he),
          stringOrListToString(comment.en)));;
    }

    return output;
  }
}

// https://github.com/Sefaria/Sefaria-Project/issues/541
const isSefariaReturningLongListsOfSingleCharacters = (comment) => {
  if (!Array.isArray(comment.he) || !Array.isArray(comment.en)) {
    return false;
  }
  const reducer = (numberOfSingleCharacters, x) =>
        numberOfSingleCharacters + ((x.length === 1) ? 1 : 0);
  // 3 is a guess of a reasonable minimum for detecting that this is a bug
  return comment.he.reduce(reducer, 0) > 3 && comment.en.reduce(reducer, 0) > 3;
}

const forEachCommentary = (commentaries, action) => {
  for (const commentaryKind of context.commentaryTypes()) {
    const commentary = commentaries[commentaryKind.englishName];
    if (commentary) {
      action(commentary, commentaryKind);
    }
  }
}

class CommentarySection extends Component {
  render() {
    const {commentaries, getOrdering, toggleShowing, sectionLabel} = this.props;
    if (!commentaries || commentaries.length === 0) {
      return;
    }

    const output = [];
    for (const commentaryClassName of getOrdering(sectionLabel)) {
      const commentaryKind = context.commentaryTypesByClassName()[commentaryClassName];
      let commentary = commentaries[commentaryKind.englishName];
      if (!commentary) {
        // TODO: investigate a better solution for the indexByClassName overlapping for Translation
        // and Steinsaltz (it appears when side-by-side is used)
        if (commentaryClassName === "translation") {
          commentary = commentaries["Steinsaltz"];
        }
        if (!commentary) {
          throw `Could not find ${commentaryClassName} commentary in${sectionLabel}`;
        }
      }
      output.push(this.renderTableRow(this.renderButton(commentaryKind), ""));
      commentary.comments.forEach(comment => {
        output.push(<CommentRow comment={comment} commentaryKind={commentaryKind} />);
      });

      if (commentary.commentary) {
        output.push(
          <CommentarySection
            commentaries={commentary.commentary}
            getOrdering={getOrdering}
            toggleShowing={toggleShowing}
            sectionLabel={`${sectionLabel}.<nested>.${commentaryKind.className}`}
            />);
      }
    }

    output.push(this.renderShowButtons());
    return output;
  }

  renderTableRow(hebrew, english) {
    const overrideFullRow = context.translationOption() === "english-side-by-side";
    return <TableRow hebrew={hebrew} english={english} overrideFullRow={overrideFullRow} />;
  }

  renderShowButtons() {
    const {commentaries, getOrdering, sectionLabel} = this.props;
    const buttons = [];
    forEachCommentary(commentaries, (commentary, commentaryKind) => {
      if (!getOrdering(sectionLabel).includes(commentaryKind.className)) {
        buttons.push(this.renderButton(commentaryKind));
      }
    });
    return this.renderTableRow(buttons, "");
  }

  buttonToFocusAfterEnter = createRef();

  renderButton(commentaryKind) {
    const {toggleShowing, sectionLabel} = this.props;

    if (localStorage.showTranslationButton !== "yes"
        && commentaryKind.className === "translation") {
      return;
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
        this.setState({...this.state, buttonToFocus: commentaryKind});
      }
    }
    const applyButtonToFocusRef = (element) => {
      if (this.state.buttonToFocus === commentaryKind) {
        element.ref = this.buttonToFocusAfterEnter;
      }
      return element;
    };

    return applyButtonToFocusRef(
      <a class={this.buttonClasses(commentaryKind)}
         tabindex="0"
         onclick={onClick}
         onkeyup={onKeyUp}>
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
      this.setState({...this.state, buttonToFocus: undefined});
    }
  }
}


class Section extends Component {
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
    sectionContents.push(
      // TODO: can this id be removed with a `#${sectionLabel} .gemara` selector?
      <TableRow
        hebrew={`<div class="gemara" id="${sectionLabel}-gemara">${section.he}</div>`}
        hebrewDoubleClickListener={() => this.toggleShowing(true, sectionLabel, "translation")}
        english={context.translationOption() === "english-side-by-side" ? section.en : undefined}
        classes={["gemara-container"]} />);

    if (section.commentary) {
      sectionContents.push(
        <CommentarySection
          commentaries={section.commentary}
          getOrdering={sectionLabel => this.state[sectionLabel] || []}
          toggleShowing={(...args) => this.toggleShowing(false, ...args)}
          sectionLabel={sectionLabel} />);
    }

    return (
      <div id={sectionLabel} class="section-container" sefaria-ref={section["ref"]}>
        {sectionContents}
      </div>
    );
  }
}

class Amud extends Component {
  render() {

    const {amudData} = this.props;
    const output = [<h2>{amudData.title}</h2>];
    if (amudData.loading) {
      output.push(
        <div key={`${amudData.id}-loading-spinner`}
             class="text-loading-spinner mdl-spinner mdl-spinner--single-color mdl-js-spinner is-active" />);
    }

    for (let i = 0; i < amudData.sections.length; i++) {
      const section = amudData.sections[i];
      if (i !== 0 && section.steinsaltz_start_of_sugya) {
        output.push(<br class="sugya-separator" />);
      }

      const sectionLabel = `${amudData.id}_section_${i+1}`;
      output.push(<Section section={section} sectionLabel={sectionLabel} />);
    }
    return <div id={`amud-${amudData.id}`} class="amudContainer">
      {output}
    </div>;
  }
}

class Amudim extends Component {
  state = {}

  render() {
    if (!this.state.isReady) {
      return [];
    }
    return this.props.allAmudim().map(amud => <Amud amudData={amud} />);
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

class Renderer {
  constructor(commentaryTypes, translationOption) {
    this._commentaryTypes = commentaryTypes;
    this._translationOption = translationOption;
    this.rootComponent = createRef();
    this.allAmudim = {};
  }

  _applyClientSideDataTransformations(amudData) {
    if (!amudData.sections) {
      amudData.sections = [];
    }
    for (const section of amudData.sections) {
      const commentaries = section.commentary;

      if (commentaries) {
        if (this._translationOption === "both") {
          commentaries.Translation = commentaries.Steinsaltz;
          if (commentaries.Translation) {
            // e.g. Hadran sections have no steinsaltz
            commentaries.Translation.comments[0].en = section.en;
          }
          delete commentaries.Steinsaltz;
        }
      }
    }
  }

  register(divId) {
    const context = {
      translationOption: this._translationOption,
      commentaryTypes: this._commentaryTypes,
      commentaryTypesByClassName: indexCommentaryTypesByClassName(this._commentaryTypes),
    };

    render(
      <ConfigurationContext.Provider value={context}>
        <Amudim ref={this.rootComponent} allAmudim={() => this.getAmudim()} />
      </ConfigurationContext.Provider>,
      document.getElementById(divId));
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
        if (!object.commentary) object.commentary = {}
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
    if (flattened.length > 0) {
      return {comments: flattened};
    }
  }

  sortedAmudim() {
    throw "Not implemented!";
  }
}

const indexCommentaryTypesByClassName = (commentaryTypes) => {
  const result = {};
  for (const type of commentaryTypes) {
    result[type.className] = type;
  }
  return result;
}

class TalmudRenderer extends Renderer {
  constructor(translationOption) {
    super(TalmudRenderer._defaultCommentaryTypes(), translationOption);
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
        className: "tosafot"
      },
      {
        englishName: "Rabbeinu Chananel",
        hebrewName: 'ר"ח',
        className: "rabbeinu-chananel",
      },
      {
        englishName: "Ramban",
        hebrewName: 'רמב״ן',
        className: "ramban"
      },
      {
        englishName: "Rashba",
        hebrewName: 'רשב״א',
        className: "rashba"
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
  _concat: _concat,
  Renderer: Renderer,
  TalmudRenderer: TalmudRenderer,
};
