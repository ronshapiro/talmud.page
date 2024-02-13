import * as React from "react";
import ContentEditable from "react-contenteditable";
import {animated, useSpring} from "@react-spring/web";
import {useConfiguration} from "./context";
import {sanitizeHtml} from "../source_formatting/html_sanitization_web";

const {
  useCallback,
  useEffect,
  useState,
} = React;

interface SnackbarProps {
  children: any;
}

function Snackbar({children}: SnackbarProps): React.ReactElement {
  const [isShowing, setShowing] = useState(false);
  const style = useSpring({bottom: isShowing ? "0px" : "-400px"});
  useEffect(() => {
    setTimeout(() => setShowing(true), 10); // do not submit
  });
  return <animated.div id="hello" className="snackbar" style={style}>{children}</animated.div>;
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
  updateSearchQuery: (query: string) => void;
}

// do not submit rename search to inpage search
export function Search({updateSearchQuery}: SearchProps): React.ReactElement {
  const {translationOption} = useConfiguration();
  const [content, setContent] = useState("");
  const onContentChange = useCallback((event) => {
    const newText = unescape(sanitizeHtml(event.currentTarget.innerHTML).trim());
    setContent(newText);
    updateSearchQuery(newText.trim());
  }, []);
  const isEnglish = translationOption() === "english-side-by-side";
  const placeholder = isEnglish ? "Search..." : "חפש...";
  const direction = isEnglish ? "ltr" : "rtl";
  return (
    <Snackbar>
      <ContentEditable
        dir={direction}
        className="inPageSearchBar"
        placeholder={placeholder}
        html={content}
        onChange={onContentChange} />
    </Snackbar>
  );
}
