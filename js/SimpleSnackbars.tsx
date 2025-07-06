import * as React from "react"; // React may not be strictly needed if only functions are exported
import { useSnackbar, SnackbarConfig } from "./SnackbarProvider";

// --- TEXT_SELECTION Snackbar ---
// This snackbar was shown with dynamic content and buttons.
// So, we'll provide a function that can be called with the specific content.

export interface TextSelectionButton {
  text: string;
  onClick: () => void;
}

export function showTextSelectionSnackbar(
  snackbarHook: ReturnType<typeof useSnackbar>, // Pass the hook's return value
  labelHtml: string | React.ReactNode,
  buttons: TextSelectionButton[]
) {
  const { showSnackbar, hideSnackbar } = snackbarHook;
  const snackbarId = "text-selection-snackbar"; // Can be dynamic if multiple are needed

  // If a text selection snackbar is already visible, perhaps update it or hide the old one first
  // For now, this will create a new one or replace based on SnackbarProvider logic for duplicate IDs.
  // Consider a more robust way to manage this specific snackbar if only one should ever be visible.

  const config: SnackbarConfig = {
    id: snackbarId,
    message: labelHtml,
    buttons: buttons.map(b => ({ text: b.text, onClick: () => { b.onClick(); hideSnackbar(snackbarId); } })),
    kind: "text-selection",
    autoHideDuration: null, // Usually, text selection actions require explicit dismissal or action
  };
  showSnackbar(config);
}

// --- ERRORS Snackbar ---
// The old errors snackbar could be updated. The new model is one snackbar per message, or one updating snackbar.
// For simplicity, let's make a function that shows an error. Multiple errors will stack.

let errorSnackbarIdCounter = 0;
export function showErrorSnackbar(
  snackbarHook: ReturnType<typeof useSnackbar>,
  errorMessageHtml: string | React.ReactNode,
  buttons?: TextSelectionButton[] // Optional buttons for errors
) {
  const { showSnackbar, hideSnackbar } = snackbarHook;
  const snackbarId = `error-snackbar-${errorSnackbarIdCounter++}`;

  const config: SnackbarConfig = {
    id: snackbarId,
    message: errorMessageHtml,
    buttons: buttons?.map(b => ({ text: b.text, onClick: () => { b.onClick(); hideSnackbar(snackbarId); } })),
    kind: "error", // css/generic-snackbar.css has styles for .snackbar-kind-error
    autoHideDuration: 8000, // Errors might auto-hide after a while
  };
  showSnackbar(config);
  return snackbarId; // Return ID if it needs to be manually hidden later
}


// --- REPORTED_ISSUE_SENT Snackbar ---
// This is a simple notification.

export function showReportedIssueSentSnackbar(
  snackbarHook: ReturnType<typeof useSnackbar>,
  message?: string | React.ReactNode
) {
  const { showSnackbar } = snackbarHook;
  const snackbarId = "reported-issue-sent-snackbar";
  const useHebrew = localStorage.languageOption === "hebrew";

  const defaultMessage = useHebrew ? "הדיווח נשלח. תודה!" : "Report sent. Thank you!";

  const config: SnackbarConfig = {
    id: snackbarId,
    message: message || defaultMessage,
    kind: "success", // Assuming it's a success message, styled in generic-snackbar.css
    autoHideDuration: 5000,
  };
  showSnackbar(config);
}

/*
Example Usage (in a component):

import { useSnackbar } from "./SnackbarProvider";
import { showTextSelectionSnackbar, showErrorSnackbar, showReportedIssueSentSnackbar } from "./SimpleSnackbars";

function MyComponent() {
  const snackbar = useSnackbar(); // Get the snackbar controls

  const handleShowError = () => {
    showErrorSnackbar(snackbar, "Something went wrong!");
  };

  const handleShowTextAction = () => {
    showTextSelectionSnackbar(snackbar, "You selected text!", [{text: "Process", onClick: () => console.log("Processing")}]);
  };

  const handleIssueReported = () => {
    showReportedIssueSentSnackbar(snackbar);
  }

  return (
    <div>
      <button onClick={handleShowError}>Show Error</button>
      <button onClick={handleShowTextAction}>Show Text Action</button>
      <button onClick={handleIssueReported}>Report Issue</button>
    </div>
  );
}

*/
