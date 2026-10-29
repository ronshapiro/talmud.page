import {$} from "./jquery";
import {RetryMethodFactory} from "./retry";
import {Button, snackbars} from "./snackbar";
import {isSiteLanguageHebrew} from "./settings";

export const POST_ERROR_AUTO_DISMISS_DELAY_MILLISECONDS = 10000;

const activeErrors: Record<string, string> = {};
const dismissedErrorIdentifiers = new Set<string>();
let errorAutoDismissTimeout: ReturnType<typeof setTimeout> | undefined;

function clearAutoDismissTimeout(): void {
  if (errorAutoDismissTimeout !== undefined) {
    clearTimeout(errorAutoDismissTimeout);
    errorAutoDismissTimeout = undefined;
  }
}

function updateErrorSnackbar(): void {
  clearAutoDismissTimeout();
  const visibleErrorIdentifiers = Object.keys(activeErrors)
    .filter(identifier => !dismissedErrorIdentifiers.has(identifier));
  if (visibleErrorIdentifiers.length > 0) {
    const message = visibleErrorIdentifiers.map(identifier => activeErrors[identifier]).join("<br>");
    const dismissButton: Button = {
      text: isSiteLanguageHebrew() ? "סגור" : "Dismiss",
      onClick: () => {
        clearAutoDismissTimeout();
        for (const identifier of visibleErrorIdentifiers) {
          dismissedErrorIdentifiers.add(identifier);
        }
        snackbars.errors.hide();
      },
    };
    snackbars.errors.show(message, [dismissButton]);
    errorAutoDismissTimeout = setTimeout(() => {
      clearAutoDismissTimeout();
      for (const identifier of visibleErrorIdentifiers) {
        dismissedErrorIdentifiers.add(identifier);
      }
      snackbars.errors.hide();
    }, POST_ERROR_AUTO_DISMISS_DELAY_MILLISECONDS);
  } else if (Object.keys(activeErrors).length === 0) {
    snackbars.errors.hide();
  }
}

export function resetPostErrorsForTesting(): void {
  clearAutoDismissTimeout();
  for (const errorIdentifier of Object.keys(activeErrors)) {
    delete activeErrors[errorIdentifier];
  }
  dismissedErrorIdentifiers.clear();
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
  if (errorObject.responseJSON?.reason && typeof errorObject.responseJSON.reason === "string") {
    return errorObject.responseJSON.reason;
  }
  if (errorObject.responseJSON?.message && typeof errorObject.responseJSON.message === "string") {
    return errorObject.responseJSON.message;
  }
  if (errorObject.responseText && typeof errorObject.responseText === "string") {
    const trimmedText = errorObject.responseText.trim();
    if (trimmedText && !trimmedText.startsWith("<")) {
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
  add: (identifier: string, errorMessage: string) => {
    if (activeErrors[identifier] !== errorMessage) {
      dismissedErrorIdentifiers.delete(identifier);
    }
    activeErrors[identifier] = errorMessage;
  },
  remove: (identifier: string) => {
    delete activeErrors[identifier];
    dismissedErrorIdentifiers.delete(identifier);
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
    const ref = data?.ref;
    const errorText = extractErrorMessage(errorResponse);
    const isHebrew = isSiteLanguageHebrew();
    if (endpoint.startsWith("/corrections")) {
      const baseMessage = isHebrew
        ? (ref ? `שגיאה בשליחת תיקון של ${ref}` : "שגיאה בשליחת תיקון")
        : (ref ? `Failed to post correction on ${ref}` : "Failed to post correction");
      return errorText ? `${baseMessage}: ${errorText}` : baseMessage;
    }
    if (endpoint.startsWith("/api/rsi-review-decision")) {
      const baseMessage = isHebrew
        ? (ref ? `שגיאה בשליחת החלטת ביקורת של ${ref}` : "שגיאה בשליחת החלטת ביקורת")
        : (ref ? `Failed to submit review decision for ${ref}` : "Failed to submit review decision");
      return errorText ? `${baseMessage}: ${errorText}` : baseMessage;
    }
    if (endpoint.startsWith("/api/suggest-rsi-task")) {
      const baseMessage = isHebrew
        ? "שגיאה בשליחת הצעה"
        : "Failed to submit suggestion";
      return errorText ? `${baseMessage}: ${errorText}` : baseMessage;
    }
    if (ref) {
      const baseMessage = isHebrew
        ? `שגיאה בבקשה עבור ${ref}`
        : `Failed request for ${ref}`;
      return errorText ? `${baseMessage}: ${errorText}` : baseMessage;
    }
    return errorText;
  },
});
