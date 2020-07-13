/* global $ */
import React, {
  Component,
  createRef,
  useContext,
  useState,
} from "react";
import PropTypes from 'prop-types';
import _concat from "./concat.js";
import isEmptyText from "./is_empty_text.js";
import {ConfigurationContext} from "./context.js";

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

const calculateLineCount = (node) => {
  const height = node.height();
  for (let i = 1; true; i++) { // eslint-disable-line no-constant-condition
    node.html(brTags(i));
    const currentHeight = node.height();
    if (currentHeight >= height) {
      return i;
    }
  }
};

function TableRow(props) {
  const {
    hebrew,
    english,
    classes,
    hebrewDoubleClickListener,
    id,
    overrideFullRow,
    isHiddenRow,
  } = props;

  const [hebrewLineCount, setHebrewLineCount] = useState(1);
  const [isEnglishExpanded, setIsEnglishExpanded] = useState(isHiddenRow || false);
  const englishRef = createRef();
  const context = useContext(ConfigurationContext);

  const applyHiddenNode = (contents, node) => {
    // estimating size is only doable with html as a string, as calling ReactDOM.render() within a
    // component is unsupported due to its side effects.
    if (typeof contents === "string") {
      node.html(contents);
    } else {
      node.html("");
    }
  };

  const shouldTranslationWrap = () => {
    if (context.isFake || !context.wrapTranslations || !isEnglishExpanded) {
      return false;
    }

    const hiddenHebrew = $(context.hiddenHost).find(".hebrew");
    const hiddenEnglish = $(context.hiddenHost).find(".english");
    applyHiddenNode(hebrew, hiddenHebrew);
    applyHiddenNode(english, hiddenEnglish);
    const totalEnglishLines = calculateLineCount(hiddenEnglish);
    applyHiddenNode(brTags(totalEnglishLines - 3 /* heuristic */), hiddenEnglish);

    return hiddenHebrew.height() < hiddenEnglish.height();
  };

  const cellClasses = () => {
    if ((isEmptyText(hebrew) || isEmptyText(english)) && !overrideFullRow) {
      return ["fullRow"];
    }
    return [];
  };

  // TODO: use this to calculate the line clamp lines. Also memoize!
  const shouldWrap = shouldTranslationWrap();

  const cells = [];
  if (!isEmptyText(hebrew)) {
    cells.push(
      <HebrewCell
        key="hebrew"
        text={hebrew}
        classes={cellClasses()}
        updateHebrewLineCount={setHebrewLineCount}
        hebrewDoubleClickListener={hebrewDoubleClickListener}
        isEnglishExpanded={isEnglishExpanded}
        englishRef={englishRef}
        shouldWrap={shouldWrap}
        />);
  }
  if (!isEmptyText(english)) {
    const toggleEnglishExpanded = () => setIsEnglishExpanded(previousState => !previousState);
    cells.push(
      <EnglishCell
        key="english"
        text={english}
        classes={cellClasses()}
        englishRef={englishRef}
        toggleEnglishExpanded={toggleEnglishExpanded}
        isEnglishExpanded={isEnglishExpanded}
        lineClampLines={hebrewLineCount}
        shouldWrap={shouldWrap}
        />);
  }

  return (
    <div
      id={id}
      className={_concat(["table-row"], classes).join(" ")}
      sefaria-ref={props["sefaria-ref"]}
      >
      {cells}
    </div>
  );
}
TableRow.propTypes = {
  hebrew: PropTypes.node,
  english: PropTypes.node,
  id: PropTypes.string,
  classes: PropTypes.arrayOf(PropTypes.string),
  hebrewDoubleClickListener: PropTypes.func,
  "sefaria-ref": PropTypes.string,
  overrideFullRow: PropTypes.bool,
  isHiddenRow: PropTypes.bool,
};

export default TableRow;
