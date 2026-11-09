import * as React from "react";
import ContentEditable from "react-contenteditable";
import {animated, useSpring} from "@react-spring/web";
import {useConfiguration} from "./context";
import {useHtmlRef} from "./hooks";
import {sanitizeHtml} from "../source_formatting/html_sanitization_web";
import {NullaryFunction} from "./types";
import {useScrollTo} from "./useScrollTo";

const {
  useEffect,
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
    (localStorage.darkMode !== "true" && localStorage.darkMode !== "gray")
      ? "mdl-button--colored" : "mdl-button--normal-text-color",
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

type UpdateSearchQuery = (key: string, query: string) => void;

interface SearchProps {
  queryCount: number;
  updateSearchQuery: UpdateSearchQuery;
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
  // `colors` saves the ordering and presence of colors.
  const [colors, setColors] = useState([COLORS[0]]);
  const [contentsByColor, setContentsByColor] = useState({} as Record<string, string | undefined>);
  const setContentForColor = recordStateSetter(setContentsByColor);

  const colorsRef = useRef(colors);
  colorsRef.current = colors;

  const contentsByColorRef = useRef(contentsByColor);
  contentsByColorRef.current = contentsByColor;

  const temporaryColorRef = useRef<string | undefined>(undefined);

  const findNextAvailableColor = (
    currentColors: string[],
    currentContents: Record<string, string | undefined>,
  ): string | undefined => {
    for (const color of currentColors) {
      const content = currentContents[color];
      if (!content || content === "") {
        return color;
      }
    }
    for (const color of COLORS) {
      if (!currentColors.includes(color)) {
        return color;
      }
    }
    return undefined;
  };

  const hasAvailableColor = findNextAvailableColor(colors, contentsByColor) !== undefined;
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

  const setTemporarySearch = (queryText: string): string | undefined => {
    let color = temporaryColorRef.current;
    if (!color) {
      color = findNextAvailableColor(colorsRef.current, contentsByColorRef.current);
      if (!color) {
        return undefined;
      }
      temporaryColorRef.current = color;
    }
    updateSearchQuery(color, queryText);
    return color;
  };

  const clearTemporarySearch = (): void => {
    const color = temporaryColorRef.current;
    if (color) {
      temporaryColorRef.current = undefined;
      const existingContent = contentsByColorRef.current[color];
      if (!existingContent || existingContent === "") {
        updateSearchQuery(color, "");
      }
    }
  };

  const getTemporarySearchColor = (): string | undefined => {
    return temporaryColorRef.current;
  };

  const addNewSearch = (initialText?: string) => {
    const nextColor = findNextAvailableColor(colorsRef.current, contentsByColorRef.current);
    if (nextColor) {
      if (!colorsRef.current.includes(nextColor)) {
        setColors([...colorsRef.current, nextColor]);
      }
      setContentForColor(nextColor, initialText);
    }
  };

  const newSearchWithText = (initialText: string) => {
    setShowing(true);

    const temporaryColor = temporaryColorRef.current;
    temporaryColorRef.current = undefined;

    const targetColor = temporaryColor || findNextAvailableColor(
      colorsRef.current,
      contentsByColorRef.current,
    );
    if (!targetColor) {
      return;
    }

    if (!colorsRef.current.includes(targetColor)) {
      setColors([...colorsRef.current, targetColor]);
    }
    setContentForColor(targetColor, initialText);
    updateSearchQuery(targetColor, initialText);
  };

  (window as any).SEARCH = (hasAvailableColor || temporaryColorRef.current !== undefined)
    ? newSearchWithText
    : undefined;
  (window as any).SET_TEMPORARY_SEARCH = setTemporarySearch;
  (window as any).CLEAR_TEMPORARY_SEARCH = clearTemporarySearch;
  (window as any).GET_TEMPORARY_SEARCH_COLOR = getTemporarySearchColor;

  useEffect(() => {
    return () => {
      delete (window as any).SEARCH;
      delete (window as any).SET_TEMPORARY_SEARCH;
      delete (window as any).CLEAR_TEMPORARY_SEARCH;
      delete (window as any).GET_TEMPORARY_SEARCH_COLOR;
    };
  }, []);

  const removeSearch = (color: string) => {
    setColors(oldColors => {
      const newColors = oldColors.filter(existingColor => existingColor !== color);
      setShowing(newColors.length > 0);
      return newColors;
    });
    setContentsByColor(oldContents => {
      const newContents = {...oldContents};
      delete newContents[color];
      return newContents;
    });
    updateSearchQuery(color, "");
  };

  const onSearchShowHideClick = () => {
    setShowing(previousShowing => {
      if (!previousShowing && colors.length === 0) {
        setColors([COLORS[0]]);
      }
      return !previousShowing;
    });
  };

  const elements = [
    <div id="showSearch" key="showSearch">
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
    elements.push(<div id="snackbars" key="snackbars">{actualSnackbars}</div>);
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
  const scrolling = useScrollTo(`.foundTerm.${color}`);
  const {matches, currentMatch, scrollToDiffedIndex} = scrolling;

  const updateRegex = () => {
    const newText = unescapeHtml(sanitizeHtml(contentEditableRef.current.innerHTML).trim());
    setContent(newText);
    updateSearchQuery(color, newText.trim());
    scrolling.clearState();
  };

  useEffect(() => {
    if (content !== localContent) {
      const newText = unescapeHtml(sanitizeHtml(content).trim());
      setContent(newText);
      updateSearchQuery(color, newText.trim());
    }
  });

  const isEnglish = useIsEnglish();

  const closeSnackbarRef = useRef<CloseSnackbarFn>();
  const onClear = () => {
    if (content.length === 0) {
      closeSnackbarRef.current!().then(() => removeSearch());
    } else {
      setContent("");
      updateSearchQuery(color, "");
    }
  };

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

  const currentMatchText = currentMatch === undefined ? "" : (currentMatch + 1).toString();
  const matchCounterText = (
    matches > 0
      ? <span key="c" className="searchMatchCounter">{currentMatchText} / {matches}</span>
      : null
  );
  const disabled = matches <= 1;

  children.push(
    <span key="buttons">
      {matchCounterText}
      <SnackbarButton key="down" disabled={disabled} onClick={() => scrollToDiffedIndex(1)}>
        <i className="material-icons">arrow_downward</i>
      </SnackbarButton>
      <SnackbarButton key="up" disabled={disabled} onClick={() => scrollToDiffedIndex(-1)}>
        <i className="material-icons">arrow_upward</i>
      </SnackbarButton>
    </span>);

  return <Snackbar close={closeSnackbarRef}><div>{children}</div></Snackbar>;
}
