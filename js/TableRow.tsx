import * as React from "react";
import * as PropTypes from 'prop-types';
import {useHtmlRef} from "./hooks";
import isEmptyText from "./is_empty_text";
import {$} from "./jquery";
import {onClickKeyListener} from "./key_clicks";
import {useConfiguration, useHiddenHost} from "./context";
import {SwipeableBackground} from "./SwipeableBackground";

const {
  useEffect,
  useMemo,
  useState,
} = React;

const brTagsCache: Record<number, string> = {};
function brTags(count: number): string {
  if (count in brTagsCache) {
    return brTagsCache[count];
  }
  if (count <= 0) {
    return "";
  }

  const result = new Array(count).fill("<br>").join("");
  brTagsCache[count] = result;
  return result;
}

interface CellTextProps {
  text: string;
  onDoubleClick?: () => void;
  sefariaRef?: string;
  languageClass: string;
  classes?: string[];
  sectionIdForHighlighting?: string;
}

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
}: CellTextProps): React.ReactElement {
  const context = useConfiguration();
  const ref = useHtmlRef<HTMLSpanElement>();
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

interface CloseButtonProps {
  onClose: () => void;
}

function CloseButton({onClose}: CloseButtonProps): React.ReactElement {
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

type StringOrElement = string | React.ReactElement

interface BaseCellProps {
  direction: "ltr" | "rtl";
  classes: string[];
  style?: React.CSSProperties;
  text: StringOrElement | undefined;
  doubleClickListener?: () => void;
}

function BaseCell({
  direction,
  classes,
  style,
  text,
  doubleClickListener,
}: BaseCellProps): React.ReactElement | null {
  const className = ["table-cell"].concat(classes).join(" ");
  const childrenProp = (typeof text === "string")
    ? {dangerouslySetInnerHTML: {__html: text}}
    : {children: text};
  const ref = useHtmlRef<HTMLDivElement>();

  useEffect(() => {
    $(ref.current!).betterDoubleClick(doubleClickListener);
  });

  return (
    <div
      dir={direction}
      className={className}
      ref={ref}
      style={style}
      {...childrenProp} // eslint-disable-line react/jsx-props-no-spreading
      />
  );
}

interface CellProps {
  classes: string[];
  text?: StringOrElement;
}

interface HebrewCellProps extends CellProps {
  isEnglishExpanded: boolean;
  shouldWrap: boolean;
  hebrewDoubleClickListener?: () => void;
}

function HebrewCell({
  classes,
  text,
  isEnglishExpanded,
  shouldWrap,
  hebrewDoubleClickListener,
}: HebrewCellProps): React.ReactElement | null {
  const context = useConfiguration();
  const siblingExpandedClass = (
    context.wrapTranslations() && isEnglishExpanded && shouldWrap
      ? "siblingExpanded"
      : "");
  return (
    <BaseCell
      direction="rtl"
      classes={["hebrew", siblingExpandedClass].concat(classes)}
      text={text}
      doubleClickListener={hebrewDoubleClickListener}
      />
  );
}

interface EnglishCellProps extends CellProps {
  isEnglishExpanded: boolean;
  lineClampLines: number;
  shouldWrap: boolean;
  toggleEnglishExpanded: () => void;
}

function EnglishCell({
  text,
  classes,
  isEnglishExpanded,
  lineClampLines,
  shouldWrap,
  toggleEnglishExpanded,
}: EnglishCellProps): React.ReactElement | null {
  const context = useConfiguration();

  classes.push("english");
  if (context.isFake) {
    classes.push("neverWrap");
  } else if (!isEnglishExpanded) {
    classes.push("lineClamped");
  } else if (context.wrapTranslations() && shouldWrap) {
    // TODO: if the english cell expanded is only a little bit of extra text (1 line, or 2 short
    // ones, use the default layout and don't wrap.
    classes.push("translationWrapped");
  } else {
    classes.push("neverWrap");
  }

  return (
    <BaseCell
      direction="ltr"
      classes={classes}
      style={{WebkitLineClamp: lineClampLines}}
      text={text}
      doubleClickListener={toggleEnglishExpanded}
      />
  );
}

type JqueryNode = any;

// TODO: the cache would need to be flushed when text size/resolution changes
const calculateLineCountCache: Record<JqueryNode, number[]> = {};
function calculateLineCount(node: JqueryNode): number {
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
  throw new Error("Couldn't find height");
}

interface TableRowProps {
  hebrew?: StringOrElement;
  english?: StringOrElement;
  id?: string;
  classes: string[];
  hebrewDoubleClickListener?: () => void;
  "sefaria-ref"?: string;
  link?: string;
  overrideFullRow?: boolean;
  expandEnglishByDefault?: boolean;
  onUnexpand?: () => void;
  sectionIdForHighlighting?: string;
}

function TableRow(props: TableRowProps): React.ReactElement {
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

  const [isEnglishExpanded, setIsEnglishExpanded] = useState(expandEnglishByDefault ?? false);
  const context = useConfiguration();
  const hiddenHost = useHiddenHost();

  const applyHiddenNode = (contents: StringOrElement | undefined, node: JqueryNode) => {
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
      return {shouldWrap: false, englishLineClampLines: 1000000};
    }

    applyHiddenNode(hebrew, hiddenHost.hebrew);
    applyHiddenNode(english, hiddenHost.english);

    const totalEnglishLines = calculateLineCount(hiddenHost.english);
    const heightRatio = hiddenHost.hebrew.height() / hiddenHost.english.height();

    applyHiddenNode(brTags(totalEnglishLines - 3 /* heuristic */), hiddenHost.english);

    const result = {
      shouldWrap: hiddenHost.hebrew.height() < hiddenHost.english.height(),
      englishLineClampLines: Math.floor(heightRatio * totalEnglishLines),
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
