import * as React from "react";
import ContentEditable from "react-contenteditable";
import {sanitizeHtml} from "../source_formatting/html_sanitization_web";

const {
  useCallback,
  useState,
} = React;

const DEFAULT_HINT = "Do not submit";

interface SearchProps {
  updateSearchQuery: (query: string) => void;
}

// do not submit rename search to inpage search
export function Search({updateSearchQuery}: SearchProps): React.ReactElement {
  const [content, setContent] = useState(DEFAULT_HINT);
  const onContentChange = useCallback((event) => {
    const newText = sanitizeHtml(event.currentTarget.innerHTML).trim();
    setContent(newText.length > 0 ? newText : DEFAULT_HINT);
    updateSearchQuery(newText);
  }, []);
  return (
    <ContentEditable
      html={`<h1>${content}</h1>`}
      onChange={onContentChange} />
  );
}
