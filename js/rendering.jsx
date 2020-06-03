import {onceDocumentReady} from "./once_document_ready.js";
import {Component, render, h, div, createContext, createRef} from "preact";
import {useState, useContext} from 'preact/hooks';

// do not submit: add keys wherever seems necesary

const applyDoubleClick = (element, fn) => {
  // DO NOT SUBMIT: remove jquery
  $(element).betterDoubleClick(fn);
};
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

const TranslationContext = createContext();

const debugResultsData = {}

const _concat = function() {
  const result = [];
  for (const arg of arguments) {
    if (arg) result.push(...arg);
  }
  return result;
}

// do not submit
const setVisibility = function(element, toShow) {
  if (toShow) {
    element.show();
  } else {
    element.hide();
  }
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
}

class HebrewCell extends Cell {
  defaultClasses = ["hebrew"];
  ref = createRef();

  render() {
    // DO NOT SUBMIT
    return (typeof this.props.text === "string")
      ? <div dir="rtl" class={this.classes()} ref={this.ref}
          dangerouslySetInnerHTML={{__html: this.props.text}} />
      : <div dir="rtl" class={this.classes()} ref={this.ref}>{this.props.text}</div>
  }

  componentDidMount() {
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
    // DO NOT SUBMIT: line-clampable and -webkit-line-clamp value should be state
    // do not submit: examine if english-div is necessary
    const innerClasses = ["english-div"];
    if (this.state.lineClamped) {
      innerClasses.push("line-clampable");
    }
    return (
        <div dir="ltr" class={this.classes()} ref={this.props.englishRef}>
          <div class={innerClasses.join(" ")}
               style={`-webkit-line-clamp: ${this.props.lineClampLines};`}
               dangerouslySetInnerHTML={{__html: this.props.text}} />
        </div>);
  }

  componentDidMount() {
    applyDoubleClick(
      this.props.englishRef.current,
      () => this.setState({lineClamped: !this.state.lineClamped}));
  }
}

function TableRow(props) {
  const [state, setState] = useState({hebrewLineCount: 1});
  const classes = _concat(["table-row"], props.classes).join(" ");
  const {hebrew, english, overrideFullRow} = props;
  const englishRef = createRef();

  const cellClasses = [];
  if ((isEmptyText(hebrew) || isEmptyText(english)) && !overrideFullRow) {
    cellClasses.push("fullRow");
  }

  const cells = [];
  if (!isEmptyText(hebrew)) {
    cells.push(
      <HebrewCell
        text={hebrew}
        classes={cellClasses}
        updateHebrewLineCount={newCount => setState({hebrewLineCount: newCount})}
        englishRef={englishRef} />);
  }
  if (!isEmptyText(english)) {
    cells.push(
      <EnglishCell
        text={english}
        classes={cellClasses}
        englishRef={englishRef}
        lineClampLines={state.hebrewLineCount}
        />);
  }

  const output = <div classes={classes}>{cells}</div>;
  output.props["sefaria-ref"] = props["sefaria-ref"];
  return output;
}
// DO NOT SUBMIT: break up render methods in into renderFoo() methods

class CommentRow extends Component {
  render() {
    const {commentId, comment, commentaryKind} = this.props;

    const CommentTableRow = (props) => {
      const {hebrew, english} = props;
      return (
        <TableRow
          hebrew={hebrew}
          english={english}
          sefaria-ref={comment.ref}
          commentary-kind={commentaryKind.englishName}
          />);
    };

    const output = [];
    if (commentaryKind.showTitle) {
      output.push(
        <CommentTableRow
          // DO NOT SUBMIT: this should be jsx
          hebrew={`<strong>${comment.sourceHeRef}</strong>`}
          english={isEmptyText(comment.en) ? "" : `<strong>${comment.sourceRef}</strong>`}
          />);
    }

    if (Array.isArray(comment.he) && Array.isArray(comment.en)
        && comment.he.length === comment.en.length) {
      for (let i = 0; i < comment.he.length; i++) {
        output.push(<CommentTableRow hebrew={comment.he[i]} english={comment.en[i]} />);
      }
    } else if (isSefariaReturningLongListsOfSingleCharacters(comment)) {
      output.push(<CommentTableRow hebrew={comment.he.join("")} english={comment.en.join("")} />);
    } else {
      output.push(
        <CommentTableRow
            hebrew={stringOrListToString(comment.he)}
            english={stringOrListToString(comment.en)} />);
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
  // do not submit: this._commentaryTypes
  for (const commentaryKind of TalmudRenderer._defaultCommentaryTypes()) {
    const commentary = commentaries[commentaryKind.englishName];
    if (commentary) {
      action(commentary, commentaryKind);
    }
  }
}

function CommentarySection(props) {
  const {sectionLabel, commentaries} = this.props;
  const [state, setState] = useState(() => {
    const initialState = {showing: {}};
    forEachCommentary(commentaries, (commentary, commentaryKind) => {
      initialState.showing[commentaryKind.className] = false;
    });
    return initialState;
  });

  if (!commentaries || commentaries.length === 0) {
    return;
  }

  // DO NOT SUBMIT: review what's no longer necessary in a preact world, and move whatever is
  // necessary into instance methods
  const commentId = commentaryKind => `${sectionLabel}-${commentaryKind.className}`;
  const makeButton = (commentaryKind, clazz, newValue) => {
    const classes = [
      "commentary_header",
      commentaryKind.className,
      commentaryKind.cssCategory,
      clazz,
    ].join(" ");
    const onClick = () => {
      // DO NOT SUBMIT gtag
      const stateUpdate = {
        showing: {...state.showing},
      };
      stateUpdate.showing[commentaryKind.className] = newValue;
      setState(stateUpdate);
    };
    const onKeyUp = event => {
      if (event && event.code === "Enter") {
        onClick();
        // DO NOT SUBMIT: maintain focus on the same button after rerendering
      }
    }
    return (
      <a class={classes}
         tabindex="0"
         data-commentary={commentaryKind.englishName}
         data-section-label={sectionLabel}
         data-comment-id={commentId(commentaryKind)}
         onclick={onClick}
         onkeyup={onKeyUp}
         >{commentaryKind.hebrewName}</a>);
  };

  const output = [];

  const overrideFullRow = useContext(TranslationContext) === "english-side-by-side";
  const makeTableRow = (hebrew, english) => {
    return <TableRow hebrew={hebrew} english={english} overrideFullRow={overrideFullRow} />;
  };

  forEachCommentary(commentaries, (commentary, commentaryKind) => {
    if (state.showing[commentaryKind.className]) {
      output.push(makeTableRow(makeButton(commentaryKind, "hide-button", false), ""));
      commentary.comments.forEach(comment => {
        output.push(
          <CommentRow
            commentId={commentId(commentaryKind)}
            comment={comment}
            commentaryKind={commentaryKind} />);
      });
      if (commentary.commentary) {
        // do not submit: nested commentaries should stay open if their parent commentary is closed and then reopenedn
        output.push(
          <CommentarySection
            sectionLabel={commentId(commentaryKind)}
            commentaries={commentary.commentary} />);
      }
    }
  });
  const showButtons = [];
  forEachCommentary(commentaries, (commentary, commentaryKind) => {
    if (!state.showing[commentaryKind.className]) {
      showButtons.push(makeButton(commentaryKind, "show-button", true));
    }
  });
  output.push(makeTableRow(showButtons), "");
  return output;
}

class Amud extends Component {
  static contextType = TranslationContext;

  render() {
    const {containerData} = this.props;
    const output = [<h2>{containerData.title}</h2>];
    if (containerData.loading) {
      output.push(
        <div key={`${containerData.id}-loading-spinner`}
             class="text-loading-spinner mdl-spinner mdl-spinner--single-color mdl-js-spinner is-active" />);
    }
    for (let i = 0; i < containerData.sections.length; i++) {
      const section = containerData.sections[i];
      if (i !== 0 && section.steinsaltz_start_of_sugya) {
        output.push(<br class="sugya-separator" />);
      }

      const sectionLabel = `${containerData.id}_section_${i+1}`;
      const sectionContents = []
      sectionContents.push(
        <TableRow
          hebrew={`<div class="gemara" id="${sectionLabel}-gemara">${section.he}</div>`}
          english={this.context === "english-side-by-side" ? section.en : undefined}
          classes={["gemara-container"]} />);

      if (section.commentary) {
        sectionContents.push(
          <CommentarySection sectionLabel={sectionLabel} commentaries={section.commentary} />);
      }

      output.push(
        <div id={sectionLabel} class="section-container" sefaria-ref={section["ref"]}>
          {sectionContents}
        </div>);
    }
    return output;
  }
}

class Renderer {
  constructor(commentaryTypes, translationOption) {
    this._commentaryTypes = commentaryTypes;
    this._translationOption = translationOption;
  }

  _applyClientSideDataTransformations(containerData) {
    if (!containerData.sections) {
      containerData.sections = [];
    }
    for (const section of containerData.sections) {
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

  // containerData is an awkward name, but "section" was already taken. Perhaps that can be changed
  // and then we can switch this over?
  renderContainer(containerData, divId) {
    debugResultsData[containerData.id] = containerData;
    this._applyClientSideDataTransformations(containerData);

    render(
        <TranslationContext.Provider value={this._translationOption}>
          <Amud containerData={containerData} />
        </TranslationContext.Provider>,
        document.getElementById(divId));

    // Make sure mdl always registers new views correctly
    componentHandler.upgradeAllRegistered();
  };
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

    /*
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
    // DO NOT SUBMIT
    */

    return commentaryTypes;
  }
}

module.exports = {
  _concat: _concat,
  setVisibility: setVisibility,
  Renderer: Renderer,
  TalmudRenderer: TalmudRenderer,
};
