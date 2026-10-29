import {$} from "./jquery";
import {RetryMethodFactory} from "./retry";

export function extractErrorMessage(errorResponse: unknown): string | undefined {
  if (!errorResponse) {
    return undefined;
  }
  if (typeof errorResponse === "string") {
    return errorResponse;
  }
  const errorObject = errorResponse as Record<string, any>;
  const {responseJSON, responseText, statusText, message, status} = errorObject;
  if (typeof responseJSON?.error === "string") {
    return responseJSON.error;
  }
  if (typeof responseJSON?.reason === "string") {
    return responseJSON.reason;
  }
  if (typeof responseJSON?.message === "string") {
    return responseJSON.message;
  }
  if (typeof responseText === "string") {
    const trimmedText = responseText.trim();
    if (trimmedText && !trimmedText.startsWith("<")) {
      return trimmedText;
    }
  }
  if (typeof statusText === "string" && statusText !== "error") {
    return statusText;
  }
  if (typeof message === "string") {
    return message;
  }
  if (status) {
    return `HTTP ${status}`;
  }
  return undefined;
}

export interface PostWithRetryOptions {
  onError?: (errorMessage: string | undefined, errorResponse: unknown) => void;
}

const retry = new RetryMethodFactory({
  add: (...args) => console.error(args),
  remove: (..._args) => {},
}, () => {});

export const postWithRetry: (
  endpoint: string,
  data: any,
  options?: PostWithRetryOptions,
) => Promise<any> = retry.retryingMethod({
  retryingCall: (endpoint: string, data: any) => {
    return $.ajax({
      type: "POST",
      url: `${window.location.origin}${endpoint}`,
      data: JSON.stringify(data),
      dataType: "json",
      contentType: "application/json",
    });
  },
  createError: (...params: any[]) => {
    const errorResponse = params.at(-1);
    const maybeOptions = params.length > 3 ? (params[2] as PostWithRetryOptions) : undefined;
    const errorText = extractErrorMessage(errorResponse);
    if (maybeOptions?.onError) {
      maybeOptions.onError(errorText, errorResponse);
    }
    return undefined;
  },
});
