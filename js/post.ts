import {$} from "./jquery";
import {RetryMethodFactory} from "./retry";
import {Button, snackbars} from "./snackbar";
import {isSiteLanguageHebrew} from "./settings";

const activeErrors: Record<string, string> = {};

function updateErrorSnackbar(): void {
  const errorIds = Object.keys(activeErrors);
  if (errorIds.length > 0) {
    const message = Object.values(activeErrors).join("<br>");
    const dismissButton: Button = {
      text: isSiteLanguageHebrew() ? "סגור" : "Dismiss",
      onClick: () => {
        snackbars.errors.hide();
      },
    };
    snackbars.errors.show(message, [dismissButton]);
  } else {
    snackbars.errors.hide();
  }
}

export function resetPostErrorsForTesting(): void {
  for (const errorId of Object.keys(activeErrors)) {
    delete activeErrors[errorId];
  }
}

export function extractErrorMessage(errorResponse: unknown): string | undefined {
  if (!errorResponse) {
    return undefined;
  }
  if (typeof errorResponse === "string") {
    return errorResponse;
  }
  const errorObject = errorResponse as Record<string, any>;
  if (errorObject.responseJSON?.error && typeof errorObject.responseJSON.error === "string") {
    return errorObject.responseJSON.error;
  }
  if (errorObject.responseJSON?.message && typeof errorObject.responseJSON.message === "string") {
    return errorObject.responseJSON.message;
  }
  if (errorObject.responseText && typeof errorObject.responseText === "string") {
    const trimmedText = errorObject.responseText.trim();
    if (!trimmedText.startsWith("<")) {
      return trimmedText;
    }
  }
  if (errorObject.statusText && typeof errorObject.statusText === "string" && errorObject.statusText !== "error") {
    return errorObject.statusText;
  }
  if (errorObject.message && typeof errorObject.message === "string") {
    return errorObject.message;
  }
  if (errorObject.status) {
    return `HTTP ${errorObject.status}`;
  }
  return undefined;
}

const retry = new RetryMethodFactory({
  add: (id: string, errorMessage: string) => {
    activeErrors[id] = errorMessage;
  },
  remove: (id: string) => {
    delete activeErrors[id];
  },
}, () => updateErrorSnackbar());

export const postWithRetry = retry.retryingMethod({
  retryingCall: (endpoint: string, data: any) => {
    return $.ajax({
      type: "POST",
      url: `${window.location.origin}${endpoint}`,
      data: JSON.stringify(data),
      dataType: "json",
      contentType: "application/json",
    });
  },
  createError: (endpoint: string, data: any, errorResponse: any) => {
    if (endpoint === "/corrections") {
      const ref = data?.ref;
      const errorText = extractErrorMessage(errorResponse);
      const isHebrew = isSiteLanguageHebrew();
      const baseMessage = isHebrew
        ? (ref ? `שגיאה בשליחת תיקון של ${ref}` : "שגיאה בשליחת תיקון")
        : (ref ? `Failed to post correction on ${ref}` : "Failed to post correction");
      return errorText ? `${baseMessage}: ${errorText}` : baseMessage;
    }
    return undefined;
  },
});
