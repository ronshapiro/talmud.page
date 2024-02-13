import * as React from "react";
import ContentEditable from "react-contenteditable";
import {animated, useSpring} from "@react-spring/web";
import {useConfiguration} from "./context";
import {$} from "./jquery";
import {sanitizeHtml} from "../source_formatting/html_sanitization_web";

const {
  useCallback,
  useEffect,
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
    setTimeout(() => setShowing(true), 10); // do not submit
  });
  const isEnglish = useIsEnglish();
  const direction = isEnglish ? "ltr" : "rtl";
  return (
    <animated.div className="snackbar inPageSearch" style={style} dir={direction}>
      {children}
    </animated.div>
  );
}

function unescape(text: string): string {
  return (
    text
      .replaceAll("&amp;", "&")
      .replaceAll("&nbsp;", " ")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
  );
}

interface SearchProps {
  queryCount: number;
  updateSearchQuery: (query: string) => void;
}

// do not submit rename search to inpage search
export function Search({
  updateSearchQuery,
  queryCount, // eslint-disable-line @typescript-eslint/no-unused-vars
}: SearchProps): React.ReactElement {
  const [content, setContent] = useState("");
  const [currentMatch, setCurrentMatch] = useState(0);
  const [matches, setMatches] = useState([]);
  const onContentChange = useCallback((event) => {
    const newText = unescape(sanitizeHtml(event.currentTarget.innerHTML).trim());
    setContent(newText);
    updateSearchQuery(newText.trim());
  }, []);
  const isEnglish = useIsEnglish();
  const placeholder = isEnglish ? "Search..." : "חפש...";

  useEffect(() => {
    setMatches($("[search-term-index]"));
  });

  const children = [
    <ContentEditable
      tagName="span"
      className="inPageSearchBar"
      placeholder={placeholder}
      html={content}
      onChange={onContentChange} />
  ];

  const matchCounterText = (
    matches.length > 0
      ? <span className="searchMatchCounter">{currentMatch + 1} / {matches.length}</span>
      : null
  );
  const disabled = matches.length <= 1;
  const scrollToMatchIndex = (newIndex: number) => {
    setCurrentMatch(newIndex); // do not submit: if more matches are added above, this won't work!
    $("html, body").animate({scrollTop: $(matches[newIndex]).offset().top}, 0);
  };

  children.push(
    <span>
      {matchCounterText}
      <SnackbarButton disabled={disabled} onClick={() => scrollToMatchIndex(currentMatch + 1)}>
        <i className="material-icons">arrow_downward</i>
      </SnackbarButton>
      <SnackbarButton disabled={disabled} onClick={() => scrollToMatchIndex(currentMatch - 1)}>
        <i className="material-icons">arrow_upward</i>
      </SnackbarButton>
    </span>);

  return <Snackbar><div>{children}</div></Snackbar>;
}
