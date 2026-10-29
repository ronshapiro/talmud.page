import {$} from "../jquery";
import {extractErrorMessage, postWithRetry, resetPostErrorsForTesting} from "../post";
import {Button, snackbars} from "../snackbar";

beforeEach(() => {
  localStorage.clear();
  resetPostErrorsForTesting();
});

afterEach(() => {
  resetPostErrorsForTesting();
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

  test("displays intermediate error and dismiss button on failure, continues retry, and hides error on success", async () => {
    jest.useFakeTimers();
    const errorShowSpy = jest.spyOn(snackbars.errors, "show").mockImplementation(() => Promise.resolve());
    const errorHideSpy = jest.spyOn(snackbars.errors, "hide").mockImplementation(() => Promise.resolve());

    let attemptCount = 0;
    const ajaxSpy = jest.spyOn($, "ajax").mockImplementation((() => {
      attemptCount++;
      if (attemptCount === 1) {
        return Promise.reject(Object.assign(new Error("Internal Server Error"), {
          status: 500,
          statusText: "Internal Server Error",
        }));
      }
      return Promise.resolve({success: true});
    }) as any);

    const promise = postWithRetry("/corrections", sampleCorrectionData);

    await Promise.resolve();

    expect(errorShowSpy).toHaveBeenCalledWith(
      `Failed to post correction on ${sampleCorrectionData.ref}: Internal Server Error`,
      expect.anything(),
    );

    const buttons = errorShowSpy.mock.calls[0][1] as Button[];
    expect(buttons.length).toBe(1);
    expect(buttons[0].text).toBe("Dismiss");

    expect(errorHideSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);
    await promise;

    expect(attemptCount).toBe(2);
    expect(errorHideSpy).toHaveBeenCalled();

    ajaxSpy.mockRestore();
    errorShowSpy.mockRestore();
    errorHideSpy.mockRestore();
    jest.useRealTimers();
  });

  test("displays Hebrew error message when site language is Hebrew", async () => {
    localStorage.languageOption = "hebrew";
    jest.useFakeTimers();
    const errorShowSpy = jest.spyOn(snackbars.errors, "show").mockImplementation(() => Promise.resolve());

    const ajaxSpy = jest.spyOn($, "ajax").mockImplementation((() => {
      return Promise.reject(Object.assign(new Error("Server down"), {
        status: 500,
        responseJSON: {error: "Server down"},
      }));
    }) as any);

    postWithRetry("/corrections", sampleCorrectionData);

    await Promise.resolve();

    expect(errorShowSpy).toHaveBeenCalledWith(
      `שגיאה בשליחת תיקון של ${sampleCorrectionData.ref}: Server down`,
      expect.anything(),
    );

    const buttons = errorShowSpy.mock.calls[0][1] as Button[];
    expect(buttons[0].text).toBe("סגור");

    ajaxSpy.mockRestore();
    errorShowSpy.mockRestore();
    jest.useRealTimers();
  });

  test("dismiss button hides error snackbar", async () => {
    jest.useFakeTimers();
    const errorShowSpy = jest.spyOn(snackbars.errors, "show").mockImplementation(() => Promise.resolve());
    const errorHideSpy = jest.spyOn(snackbars.errors, "hide").mockImplementation(() => Promise.resolve());

    const ajaxSpy = jest.spyOn($, "ajax").mockImplementation((() => {
      return Promise.reject(new Error("Network failure"));
    }) as any);

    postWithRetry("/corrections", sampleCorrectionData);

    await Promise.resolve();

    const buttons = errorShowSpy.mock.calls[0][1] as Button[];
    buttons[0].onClick();

    expect(errorHideSpy).toHaveBeenCalledTimes(1);

    ajaxSpy.mockRestore();
    errorShowSpy.mockRestore();
    errorHideSpy.mockRestore();
    jest.useRealTimers();
  });
});
