import * as React from "react";
import ContentEditable from "react-contenteditable";
import {animated, useSpring} from "@react-spring/web";
import {useConfiguration} from "./context";
import {$} from "./jquery";
import {sanitizeHtml} from "../source_formatting/html_sanitization_web";

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
  disabled: boolean;
  onClick: () => void;
}

function SnackbarButton({children, disabled, onClick}: SnackbarButtonProps) {
  const buttonClasses = [
    "mdl-button",
    "mdl-js-button",
    (localStorage.darkMode !== "true") ? "mdl-button--colored" : "mdl-button--normal-text-color",
  ].join(" ");
  return (
    <button className={buttonClasses} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

interface SnackbarProps {
  children: any;
}

function Snackbar({children}: SnackbarProps): React.ReactElement {
  const [isShowing, setShowing] = useState(false);
  const style = useSpring({bottom: isShowing ? "0px" : "-400px"});
  useEffect(() => {
    setTimeout(() => setShowing(true), 10);
  });
  const isEnglish = useIsEnglish();
  const direction = isEnglish ? "ltr" : "rtl";
  return (
    <animated.div className="snackbar inPageSearch" style={style} dir={direction}>
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

interface SearchProps {
  queryCount: number;
  updateSearchQuery: (query: string) => void;
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

export function InPageSearch({
  updateSearchQuery,
  // This doesn't actually do anything, but it does help ensure that when the query changes
  // this gets rerendered.
  queryCount, // eslint-disable-line @typescript-eslint/no-unused-vars
}: SearchProps): React.ReactElement | null {
  if (localStorage.showSearchBar !== "true") {
    return null;
  }
  const [content, setContent] = useState("");
  const [currentMatch, setCurrentMatch] = useState(CURRENT_MATCH_UNSET);
  const [currentMatchedView, setCurrentMatchedView] = useState(undefined);
  const [matches, setMatches] = useArrayStateBackedByLength([]);
  const onContentChange = useCallback((event) => {
    const newText = unescapeHtml(sanitizeHtml(event.currentTarget.innerHTML).trim());
    setContent(newText);
    updateSearchQuery(newText.trim());
    setCurrentMatch(CURRENT_MATCH_UNSET);
    setCurrentMatchedView(undefined);
  }, []);
  const isEnglish = useIsEnglish();

  useEffect(() => {
    setMatches(Array.from($(".foundTerm")));
  });

  useMemo(() => {
    if (currentMatchedView) {
      const newIndex = matches.indexOf(currentMatchedView);
      setCurrentMatch(newIndex === -1 ? CURRENT_MATCH_UNSET : newIndex);
    }
  }, [matches.length]);

  const children = [
    <ContentEditable
      key="searchBar"
      tagName="span"
      className="inPageSearchBar"
      placeholder={isEnglish ? "Search..." : "חפש..."}
      html={content}
      onChange={onContentChange} />,
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
      <SnackbarButton key="down" disabled={disabled} onClick={() => scrollToDiffedIndex(1)}>
        <i className="material-icons">arrow_downward</i>
      </SnackbarButton>
      <SnackbarButton key="up" disabled={disabled} onClick={() => scrollToDiffedIndex(-1)}>
        <i className="material-icons">arrow_upward</i>
      </SnackbarButton>
    </span>);

  return <Snackbar><div>{children}</div></Snackbar>;
}
