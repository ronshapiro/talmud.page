import * as React from "react";
import {postWithRetry} from "./post";

const {useEffect, useRef, useState} = React;

type Status = "collapsed" | "editing" | "sending" | "sent" | "error";

const menuItemStyle: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  textTransform: "none",
};

/**
 * The page's top-left overflow menu: settings, plus a way to suggest a new task for the
 * recursive-self-improving content agent. Suggestions are filed as a GitHub issue (see
 * express.ts's /api/suggest-rsi-task) labeled "rsi-suggestion", which a scheduled triage run
 * reads periodically.
 */
export function OverflowMenu(): React.ReactElement {
  const [status, setStatus] = useState<Status>("collapsed");
  const [text, setText] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [menuOpen]);

  if (status === "collapsed") {
    return (
      <div ref={menuRef}>
        <button
          id="overflow-menu-button"
          className="mdl-button mdl-js-button mdl-button--icon"
          aria-label="More actions"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(open => !open)}>
          <i className="material-icons">more_vert</i>
        </button>
        {menuOpen && (
          <div
            style={{
              position: "fixed",
              top: "65px",
              left: "15px",
              background: "#fff",
              boxShadow: "0 2px 2px 0 rgba(0,0,0,.14), 0 3px 1px -2px rgba(0,0,0,.2), "
                + "0 1px 5px 0 rgba(0,0,0,.12)",
              borderRadius: "2px",
              zIndex: 999,
              minWidth: "180px",
            }}>
            <button
              className="mdl-button mdl-js-button"
              style={menuItemStyle}
              onClick={() => {
                setMenuOpen(false);
                // Preferences owns the settings panel's own open/close state; this reaches into
                // it the same way snackbar.ts's window.showPreferences() nudge does, rather than
                // duplicating that state here.
                (window as any).togglePreferences();
              }}>
              Settings
            </button>
            <button
              className="mdl-button mdl-js-button"
              style={menuItemStyle}
              onClick={() => {
                setMenuOpen(false);
                setStatus("editing");
              }}>
              Suggest something the site could do automatically
            </button>
          </div>
        )}
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
