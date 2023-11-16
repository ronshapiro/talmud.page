import React, {
  Component,
  createRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from 'prop-types';
import {animated, useSpring} from "@react-spring/web";
import {useDrag} from "@use-gesture/react";
import isEmptyText from "./is_empty_text.ts";
import {$} from "./jquery";
import {onClickKeyListener} from "./key_clicks";
import {ConfigurationContext, useConfiguration, useHiddenHost} from "./context.js";
import {SwipeableBackground} from "./SwipeableBackground.tsx";

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

/**
 * This element defines the basic attributes of what is inserted in cell text. Specifically, it
 * translates html text into React nodes and applies an optional double-click listener.
 */
export function CellText({
  text,
  onDoubleClick,
  sefariaRef,
  languageClass,
  classes,
  sectionIdForHighlighting,
}) {
  const context = useConfiguration();
  const ref = useRef();
  useEffect(() => {
    $(ref.current).betterDoubleClick(onDoubleClick);
  });
  classes = classes || [];

  /* eslint-disable react/no-danger */
  const cellText = (
    // These elements are split for a technicality in ref_selection_snackbar for how texts are look
    // up. That's a hack anyway and rely's on the DOM, but refactoring it requires a good deal of
    // work. Splitting the elements was the easiest patch on top of that hack.
    <span sefaria-ref={sefariaRef} className={classes.join(" ")}>
      <span dangerouslySetInnerHTML={{__html: text}} ref={ref} className={languageClass} />
    </span>
  );

  return (
    <SwipeableBackground
      inline
      initiallyOn={context.highlightedIds.has(sectionIdForHighlighting)}
      onChange={(newState) => context.toggleHighlightedId(newState, sectionIdForHighlighting)}
    >
      {cellText}
    </SwipeableBackground>
  );
}

CellText.propTypes = {
  text: PropTypes.string.isRequired,
  onDoubleClick: PropTypes.func,
  sefariaRef: PropTypes.string,
  languageClass: PropTypes.string,
  classes: PropTypes.arrayOf(PropTypes.string),
  sectionIdForHighlighting: PropTypes.string,
};

function CloseButton({onClose}) {
  return (
    <i
      style={{
        position: "relative",
        top: "6px",
        paddingInlineEnd: "15px",
      }}
      className="material-icons"
      onClick={() => onClose()}
      onKeyUp={onClickKeyListener(onClose)}
      tabIndex={0}
      role="button"
    >
      cancel
    </i>
  );
}

CloseButton.propTypes = {
  onClose: PropTypes.func.isRequired,
};

class Cell extends Component {
  static propTypes = {
    classes: PropTypes.arrayOf(PropTypes.string).isRequired,
    text: PropTypes.node.isRequired,
  };

  classes(...extraClasses) {
    return this.props.classes.concat(["table-cell"]).concat(extraClasses).join(" ");
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
    const siblingExpandedClass = (
      this.context.wrapTranslations() && isEnglishExpanded && shouldWrap
        ? "siblingExpanded"
        : undefined);
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
  }
}

class EnglishCell extends Cell {
  static contextType = ConfigurationContext;

  ref = createRef();

  render() {
    const classes = ["english"];

    const {
      isEnglishExpanded,
      lineClampLines,
      shouldWrap,
    } = this.props;

    if (this.context.isFake) {
      classes.push("neverWrap");
    } else if (!isEnglishExpanded) {
      classes.push("lineClamped");
    } else if (this.context.wrapTranslations() && shouldWrap) {
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
        ref={this.ref}
        style={{WebkitLineClamp: lineClampLines}}
        {...this.childrenProp()} // eslint-disable-line react/jsx-props-no-spreading
        />
    );
  }

  componentDidMount() {
    $(this.ref.current).betterDoubleClick(this.props.toggleEnglishExpanded);
  }
}

// TODO: the cache would need to be flushed when text size/resolution changes
const calculateLineCountCache = {};
const calculateLineCount = (node) => {
  let nestedCache = calculateLineCountCache[node];
  if (!nestedCache) {
    nestedCache = [0];
    calculateLineCountCache[node] = nestedCache;
  }

  // TODO: optimize by using a binary search to see if the value is already within nestedCache
  const height = node.height();
  for (let i = 1; true; i++) { // eslint-disable-line no-constant-condition
    if (i === nestedCache.length) {
      node.html(brTags(i));
      nestedCache.push(node.height());
    }

    const currentHeight = nestedCache[i];
    if (currentHeight >= height) {
      return i;
    }
  }
};

function Swipeable({children, onSwiped}) {
  const [{x}, api] = useSpring(() => ({x: 0}));
  const bind = useDrag(({offset: [newX], cancel, last, canceled}) => {
    api.start({x: newX});
    if (Math.abs(newX) > 150 && last && !canceled) {
      onSwiped();
      cancel();
    } else if (last) {
      api.start({x: 0});
    }
  }, {
    // This effectively disables the feature on Desktop, which is probably fine as the X icon still
    // exists. We could get fancy by trying to detect the type of browser and set this value
    // accordingly... though not sure it's worth the complexity.
    pointer: {touch: true},
  });
  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <animated.div {...bind()} style={{x}}>
      {children}
    </animated.div>
  );
}
Swipeable.propTypes = {
  children: PropTypes.object.isRequired,
  onSwiped: PropTypes.func.isRequired,
};

function TableRow(props) {
  const {
    hebrew,
    english,
    classes,
    hebrewDoubleClickListener,
    id,
    overrideFullRow,
    link,
    expandEnglishByDefault,
    onUnexpand,
    sectionIdForHighlighting,
  } = props;

  const [isEnglishExpanded, setIsEnglishExpanded] = useState(expandEnglishByDefault);
  const context = useConfiguration();
  const hiddenHost = useHiddenHost();

  const applyHiddenNode = (contents, node) => {
    if (typeof contents === "string") {
      node.html(contents);
    } else if (contents && contents.props && Array.isArray(contents.props.children)) {
      const htmlText = [];
      for (const child of contents.props.children) {
        if (child.props && child.props.text) {
          htmlText.push(child.props.text);
        }
      }
      node.html(htmlText.join(""));
    } else {
      node.html("");
    }
  };

  const shouldTranslationWrap = () => {
    if (!hiddenHost) {
      return false;
    }

    applyHiddenNode(hebrew, hiddenHost.hebrew);
    applyHiddenNode(english, hiddenHost.english);

    const totalEnglishLines = calculateLineCount(hiddenHost.english);
    const heightRatio = hiddenHost.hebrew.height() / hiddenHost.english.height();

    applyHiddenNode(brTags(totalEnglishLines - 3 /* heuristic */), hiddenHost.english);

    const result = {
      shouldWrap: hiddenHost.hebrew.height() < hiddenHost.english.height(),
      englishLineClampLines: Math.floor(heightRatio * totalEnglishLines).toString(),
    };

    // TODO: optimize by applying this in an effect
    applyHiddenNode("", hiddenHost.hebrew);
    applyHiddenNode("", hiddenHost.english);

    return result;
  };

  const {shouldWrap, englishLineClampLines} = useMemo(shouldTranslationWrap, [
    $(context.hiddenHost).width(), // recalculate only when there are changes in width
  ]);

  const cellClasses = () => {
    if ((isEmptyText(hebrew) || isEmptyText(english)) && !overrideFullRow) {
      return ["fullRow"];
    }
    return [];
  };

  const cells = [];
  if (!isEmptyText(hebrew)) {
    const contents = (
      onUnexpand
        // eslint-disable-next-line react/jsx-one-expression-per-line
        ? <>{hebrew}<CloseButton onClose={() => onUnexpand()} /></>
        : hebrew);
    cells.push(
      <HebrewCell
        key="hebrew"
        text={contents}
        classes={cellClasses()}
        hebrewDoubleClickListener={hebrewDoubleClickListener}
        isEnglishExpanded={isEnglishExpanded}
        shouldWrap={shouldWrap}
        />);
  }
  cells.push(<div className="text-selection-divider" key="text-selection-divider" />);
  if (!isEmptyText(english)) {
    const toggleEnglishExpanded = () => setIsEnglishExpanded(previousState => !previousState);
    cells.push(
      <EnglishCell
        key="english"
        text={english}
        classes={cellClasses()}
        toggleEnglishExpanded={toggleEnglishExpanded}
        isEnglishExpanded={isEnglishExpanded}
        lineClampLines={englishLineClampLines}
        shouldWrap={shouldWrap}
        />);
  }

  const row = (
    <div
      id={id}
      className={["table-row"].concat(classes).join(" ")}
      sefaria-ref={props["sefaria-ref"]}
      tp-link={link}
      >
      {cells}
    </div>
  );

  // The swiping gesture doesn't play nicely with selecting text. Disable for now.
  // if (onUnexpand) {
  //   return <Swipeable onSwiped={onUnexpand}>{row}</Swipeable>;
  // }

  if (hiddenHost && sectionIdForHighlighting) {
    return (
      <SwipeableBackground
        initiallyOn={context.highlightedIds.has(sectionIdForHighlighting)}
        onChange={(newState) => context.toggleHighlightedId(newState, sectionIdForHighlighting)}
      >
        {row}
      </SwipeableBackground>
    );
  }
  return row;
}
TableRow.propTypes = {
  hebrew: PropTypes.node,
  english: PropTypes.node,
  id: PropTypes.string,
  classes: PropTypes.arrayOf(PropTypes.string).isRequired,
  hebrewDoubleClickListener: PropTypes.func,
  "sefaria-ref": PropTypes.string,
  link: PropTypes.string,
  overrideFullRow: PropTypes.bool,
  expandEnglishByDefault: PropTypes.bool,
  onUnexpand: PropTypes.func,
  sectionIdForHighlighting: PropTypes.string,
};

export default TableRow;
