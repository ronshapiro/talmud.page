import * as React from "react";
import ContentEditable from "react-contenteditable";
import {sanitizeHtml} from "../source_formatting/html_sanitization_web";

const {
  useCallback,
  useState,
} = React;

const START_TEXT = "DO NOT SUBMIT";
const DEFAULT_HINT = "-"; // do not submit

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
  const [content, setContent] = useState(START_TEXT);
  const onContentChange = useCallback((event) => {
    const newText = unescape(sanitizeHtml(event.currentTarget.innerHTML).trim());
    setContent(newText.length > 0 ? newText : DEFAULT_HINT);
    updateSearchQuery(newText);
    console.log(newText);
  }, []);
  return (
    <ContentEditable
      html={`<h1>${content}</h1>`}
      onChange={onContentChange} />
  );
}
