import * as React from "react";
import {postWithRetry} from "./post";

const {useState} = React;

type Status = "collapsed" | "editing" | "sending" | "sent" | "error";

/**
 * Lets a reader suggest a new task the recursive-self-improving content agent could take on.
 * Submissions are filed as a GitHub issue (see express.ts's /api/suggest-rsi-task) labeled
 * "rsi-suggestion", which a scheduled triage run reads periodically.
 */
export function RsiSuggestionBox(): React.ReactElement {
  const [status, setStatus] = useState<Status>("collapsed");
  const [text, setText] = useState("");

  if (status === "collapsed") {
    return (
      <div style={{padding: "8px", textAlign: "center"}}>
        <button
          className="mdl-button mdl-js-button"
          onClick={() => setStatus("editing")}>
          Suggest something the site could do automatically
        </button>
      </div>
    );
  }

  if (status === "sent") {
    return <div style={{padding: "8px", textAlign: "center"}}>Thanks! I&apos;ll take a look.</div>;
  }

  const submit = () => {
    if (!text.trim()) return;
    setStatus("sending");
    postWithRetry("/api/suggest-rsi-task", {suggestion: text}).then(
      () => setStatus("sent"),
      () => setStatus("error"));
  };

  return (
    <div style={{padding: "8px"}}>
      <div
        className="mdl-textfield mdl-js-textfield"
        style={{display: "block", width: "100%"}}>
        <textarea
          className="mdl-textfield__input"
          rows={2}
          value={text}
          onChange={e => setText(e.target.value)}
          id="rsi-suggestion-input" />
        {/* htmlFor/id above do associate this label; matches Feedback.tsx's sibling pattern */}
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="mdl-textfield__label" htmlFor="rsi-suggestion-input">
          What should the site do automatically?
        </label>
      </div>
      <button
        className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent"
        disabled={status === "sending"}
        onClick={submit}>
        Send
      </button>
      {status === "error" && <p>Something went wrong &mdash; try again?</p>}
    </div>
  );
}
