import {$} from "../jquery";
import {
  extractErrorMessage,
  postWithRetry,
} from "../post";
import {snackbars} from "../snackbar";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  jest.clearAllTimers();
});

describe("extractErrorMessage", () => {
  test("extracts error string", () => {
    expect(extractErrorMessage("Direct error message")).toBe("Direct error message");
  });

  test("extracts error from responseJSON.error", () => {
    expect(extractErrorMessage({responseJSON: {error: "Json error"}})).toBe("Json error");
  });

  test("extracts message from responseJSON.message", () => {
    expect(extractErrorMessage({responseJSON: {message: "Json message"}})).toBe("Json message");
  });

  test("extracts plain responseText but ignores html", () => {
    expect(extractErrorMessage({responseText: "Plain text error"})).toBe("Plain text error");
    expect(extractErrorMessage({responseText: "<html><body>Error</body></html>", statusText: "Internal Server Error"}))
      .toBe("Internal Server Error");
  });

  test("extracts statusText and status code fallback", () => {
    expect(extractErrorMessage({statusText: "Bad Request"})).toBe("Bad Request");
    expect(extractErrorMessage({status: 503})).toBe("HTTP 503");
  });

  test("returns undefined when no error details exist", () => {
    expect(extractErrorMessage(undefined)).toBeUndefined();
    expect(extractErrorMessage({})).toBeUndefined();
  });
});

describe("postWithRetry", () => {
  const sampleCorrectionData = {
    ref: "Rashi on Shabbat 2a:1:1",
    userText: "Correction text",
  };

  test("invokes onError callback with extracted message and does not use errors snackbar", async () => {
    jest.useFakeTimers();
    const errorShowSpy = jest.spyOn(snackbars.errors, "show").mockImplementation(() => Promise.resolve());
    const onErrorSpy = jest.fn();

    let attemptCount = 0;
    const ajaxSpy = jest.spyOn($, "ajax").mockImplementation((() => {
      attemptCount++;
      if (attemptCount === 1) {
        return Promise.reject(Object.assign(new Error("Forbidden"), {
          status: 403,
          statusText: "Forbidden",
          responseText: "Forbidden",
        }));
      }
      return Promise.resolve({success: true});
    }) as any);

    const promise = postWithRetry("/api/rsi-review-decision", sampleCorrectionData, {
      onError: onErrorSpy,
    });

    await Promise.resolve();

    expect(onErrorSpy).toHaveBeenCalledWith("Forbidden", expect.anything());
    expect(errorShowSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);
    await promise;

    expect(attemptCount).toBe(2);

    ajaxSpy.mockRestore();
    errorShowSpy.mockRestore();
    jest.useRealTimers();
  });

  test("succeeds without calling onError", async () => {
    const onErrorSpy = jest.fn();
    const ajaxSpy = jest.spyOn($, "ajax").mockImplementation((() => {
      return Promise.resolve({success: true});
    }) as any);

    await postWithRetry("/corrections", sampleCorrectionData, {
      onError: onErrorSpy,
    });

    expect(onErrorSpy).not.toHaveBeenCalled();

    ajaxSpy.mockRestore();
  });
});
