import * as React from "react";
import ContentEditable from "react-contenteditable";
import {animated, useSpring} from "@react-spring/web";
import {useConfiguration} from "./context";
import {useHtmlRef} from "./hooks";
import {$} from "./jquery";
import {sanitizeHtml} from "../source_formatting/html_sanitization_web";
import {NullaryFunction} from "./types";

const {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} = React;

function useIsEnglish(): boolean {
  const {translationOption} = useConfiguration();
  return translationOption() === "english-side-by-side";
}

interface SnackbarButtonProps {
  children: any;
  disabled?: boolean;
  onClick: () => void;
  extraClasses?: string[];
}

function SnackbarButton({children, disabled, onClick, extraClasses}: SnackbarButtonProps) {
  const buttonClasses = [
    "mdl-button",
    "mdl-js-button",
    (localStorage.darkMode !== "true") ? "mdl-button--colored" : "mdl-button--normal-text-color",
  ].concat(extraClasses || []).join(" ");
  return (
    <button className={buttonClasses} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

type CloseSnackbarFn = NullaryFunction<Promise<unknown>>;

interface SnackbarProps {
  children: any;
  close?: React.MutableRefObject<CloseSnackbarFn | undefined>;
}

function Snackbar({children, close}: SnackbarProps): React.ReactElement {
  const [style, api] = useSpring(() => { return {height: "0px"}; });
  const [showingState, setShowingState] = useState("starting");

  useEffect(() => {
    if (showingState === "starting") {
      setShowingState("showing");
      api.start({height: "36px"});
    }
  });
  if (close) {
    close.current = () => Promise.all(api.start({height: "0px"})).then(() => {
      setShowingState("closed");
    });
  }

  const isEnglish = useIsEnglish();
  const direction = isEnglish ? "ltr" : "rtl";
  return (
    <animated.div className="snackbar inPageSearch" dir={direction} style={style}>
      {children}
    </animated.div>
  );
}

function unescapeHtml(text: string): string {
  return (
    text
      .replaceAll("&amp;", "&")
      .replaceAll("&nbsp;", " ")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
  );
}

function useArrayStateBackedByLength<T>(array: T[]): [T[], (array: T[]) => void] {
  // React treats all setState(<array>) as updates, even if the contents have not changed (test with
  // `setX([1])`: this will loop infinitely). As a workaround, if the order and elements of the
  // state is stable, the length can be used as the actual state and the contents can be stored in a
  // Ref.
  const ref = useRef(array);
  const setLength = useState(0)[1];
  return [ref.current, (newArray: T[]) => {
    ref.current = newArray;
    setLength(newArray.length);
  }];
}

type UpdateSearchQuery = (key: string, query: string, asRegex: boolean | undefined) => void;

interface SearchProps {
  queryCount: number;
  updateSearchQuery: UpdateSearchQuery;
}

const CURRENT_MATCH_UNSET = -200;
function computeNextMatchIndex(currentIndex: number, diff: number, maxIndex: number): number {
  if (currentIndex === CURRENT_MATCH_UNSET) {
    return diff === 1 ? 0 : maxIndex - 1;
  }
  const newIndex = currentIndex + diff;
  if (newIndex < 0) {
    return maxIndex - 1;
  } else if (newIndex === maxIndex) {
    return 0;
  }
  return newIndex;
}

const COLORS = ["yellow", "purple", "green", "red", "blue", "gray"];

type RecordFunction<V> = (x: Record<string, V>) => Record<string, V>;
type RecordSetter<V> = (fn: RecordFunction<V>) => void;

function recordStateSetter<V>(setter: RecordSetter<V>) {
  return (key: string, value: V) => {
    setter(oldValue => {
      const newValue = {...oldValue};
      newValue[key] = value;
      return newValue;
    });
  };
}

export function SnackbarHost({
  updateSearchQuery,
  // This doesn't actually do anything, but it does help ensure that when the query changes
  // this gets rerendered.
  queryCount, // eslint-disable-line @typescript-eslint/no-unused-vars
}: SearchProps): React.ReactElement {
  const [isShowing, setShowing] = useState(false);
  const [colors, setColors] = useState([COLORS[0]]);
  const [contentsByColor, setContentsByColor] = useState({} as Record<string, string | undefined>);
  const setContentForColor = recordStateSetter(setContentsByColor);
  const canAddMoreColors = colors.length !== COLORS.length;

  const button = (kind: string, onClick: () => void) => {
    return (
      <button
        key={kind}
        className="mdl-button mdl-js-button mdl-button--icon"
        onClick={onClick}>
        <i className="material-icons">{kind}</i>
      </button>
    );
  };
  const addNewSearch = (initialText?: string) => {
    for (const color of COLORS) {
      if (!colors.includes(color)) {
        setColors([...colors, color]);
        setContentForColor(color, initialText);
        break;
      }
    }
  };
  const newSearchWithText = (initialText: string) => {
    if (!isShowing) {
      setShowing(true);
    }

    const latestColor = colors.slice(-1)[0];
    const latestContent = contentsByColor[latestColor];
    if (latestContent === undefined || latestContent === "") {
      setContentForColor(latestColor, initialText);
    } else {
      addNewSearch(initialText);
    }
  };
  (window as any).SEARCH = canAddMoreColors && newSearchWithText;
  const removeSearch = (color: string) => {
    setColors(oldColors => {
      const newColors = oldColors.filter(x => x !== color);
      setShowing(newColors.length > 0);
      return newColors;
    });
  };

  const onSearchShowHideClick = () => {
    setShowing(previous => {
      if (!previous && colors.length === 0) {
        setColors([COLORS[0]]);
      }
      return !previous;
    });
  };

  const elements = [
    <div id="showSearch">
      {button("search", onSearchShowHideClick)}
      {isShowing && canAddMoreColors ? button("add", () => addNewSearch()) : null}
    </div>,
  ];

  if (isShowing) {
    /* eslint-disable @typescript-eslint/no-use-before-define */
    const actualSnackbars = colors.map(color => (
      <IndividualSearchRow
        key={color}
        color={color}
        updateSearchQuery={updateSearchQuery}
        removeSearch={() => removeSearch(color)}
        content={contentsByColor[color] || ""}
        setContent={(newContent) => setContentForColor(color, newContent)}
        />));
    elements.push(<div id="snackbars">{actualSnackbars}</div>);
    /* eslint-enable @typescript-eslint/no-use-before-define */
  }

  return <div id="snackbarHost" className={isShowing ? "showing" : ""}>{elements}</div>;
}

interface IndividualSearchRowProps {
  color: string;
  updateSearchQuery: UpdateSearchQuery;
  removeSearch: () => void;
  content: string;
  setContent: (_: string) => void;
}
function IndividualSearchRow({
  color,
  updateSearchQuery,
  removeSearch,
  content,
  setContent,
}: IndividualSearchRowProps): React.ReactElement {
  const [localContent, setLocalContent] = useState("");
  const inheritedSetContent = setContent;
  setContent = (newContent: string) => {
    inheritedSetContent(newContent);
    setLocalContent(newContent);
  };
  const contentEditableRef = useHtmlRef<HTMLElement>();
  const [asRegex, setAsRegexBase] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(CURRENT_MATCH_UNSET);
  const [currentMatchedView, setCurrentMatchedView] = useState(undefined);
  const [matches, setMatches] = useArrayStateBackedByLength([]);
  const updateRegex = useCallback((overrideAsRegexValue?: boolean) => {
    const newText = unescapeHtml(sanitizeHtml(contentEditableRef.current.innerHTML).trim());
    setContent(newText);
    const asRegexValue = overrideAsRegexValue !== undefined ? overrideAsRegexValue : asRegex;
    updateSearchQuery(color, newText.trim(), asRegexValue);
    setCurrentMatch(CURRENT_MATCH_UNSET);
    setCurrentMatchedView(undefined);
  }, [asRegex]);
  const setAsRegex = (value: boolean) => {
    setAsRegexBase(value);
    updateRegex(value);
  };

  useEffect(() => {
    if (content !== localContent) {
      const newText = unescapeHtml(sanitizeHtml(content).trim());
      setContent(newText);
      updateSearchQuery(color, newText.trim(), false);
    }
  });

  const isEnglish = useIsEnglish();

  useEffect(() => {
    setMatches(Array.from($(`.foundTerm.${color}`)));
  });

  const closeSnackbarRef = useRef<CloseSnackbarFn>();

  const onClear = () => {
    if (content.length === 0) {
      closeSnackbarRef.current!().then(() => removeSearch());
    } else {
      setContent("");
      updateSearchQuery(color, "", undefined);
    }
  };

  useMemo(() => {
    if (currentMatchedView) {
      const newIndex = matches.indexOf(currentMatchedView);
      setCurrentMatch(newIndex === -1 ? CURRENT_MATCH_UNSET : newIndex);
    }
  }, [matches.length]);

  const children = [
    <SnackbarButton key="clear" onClick={() => onClear()}>
      <i className="material-icons">close</i>
    </SnackbarButton>,
    <ContentEditable
      key="searchBar"
      tagName="span"
      className="inPageSearchBar"
      placeholder={isEnglish ? "Search..." : "חפש..."}
      html={content}
      innerRef={contentEditableRef}
      onChange={() => updateRegex()} />,
  ];

  const currentMatchText = currentMatch === CURRENT_MATCH_UNSET ? "" : (currentMatch + 1).toString();
  const matchCounterText = (
    matches.length > 0
      ? <span key="c" className="searchMatchCounter">{currentMatchText} / {matches.length}</span>
      : null
  );
  const disabled = matches.length <= 1;
  const scrollToDiffedIndex = (diff: number) => {
    const newIndex = computeNextMatchIndex(currentMatch, diff, matches.length);
    setCurrentMatch(newIndex);
    const newMatchedView = matches[newIndex];
    setCurrentMatchedView(newMatchedView);
    $("html, body").animate({scrollTop: $(newMatchedView).offset().top}, 0);
  };

  children.push(
    <span key="buttons">
      {matchCounterText}
      <SnackbarButton
        key="regex"
        extraClasses={asRegex ? ["mdl-button--raised"] : []}
        onClick={() => setAsRegex(!asRegex)}>
        /.*/
      </SnackbarButton>
      <SnackbarButton key="down" disabled={disabled} onClick={() => scrollToDiffedIndex(1)}>
        <i className="material-icons">arrow_downward</i>
      </SnackbarButton>
      <SnackbarButton key="up" disabled={disabled} onClick={() => scrollToDiffedIndex(-1)}>
        <i className="material-icons">arrow_upward</i>
      </SnackbarButton>
    </span>);

  return <Snackbar close={closeSnackbarRef}><div>{children}</div></Snackbar>;
}
