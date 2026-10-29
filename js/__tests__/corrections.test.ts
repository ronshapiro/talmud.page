import {
  CORRECTION_ERROR_AUTO_DISMISS_DELAY_MILLISECONDS,
  postCorrection,
  resetCorrectionDismissTimerForTesting,
} from "../corrections";
import {post} from "../post";
import {Button, snackbars} from "../snackbar";
import {trackEvent} from "../analytics";

jest.mock("../post", () => ({post: jest.fn()}));
jest.mock("../analytics", () => ({trackEvent: jest.fn()}));

beforeEach(() => {
  localStorage.clear();
  (post as jest.Mock).mockReset();
  (trackEvent as jest.Mock).mockReset();
});

afterEach(() => {
  resetCorrectionDismissTimerForTesting();
});

describe("postCorrection", () => {
  const sampleCorrectionData = {
    ref: "Rashi on Shabbat 2a:1:1",
    hebrew: "עברית",
    hebrewHighlighted: undefined,
    translation: "translation text",
    translationHighlighted: undefined,
    pathname: "/Shabbat.2a",
    userText: "Correction details",
    isAiEdit: true,
  };

  test("shows initial status and hides after success", async () => {
    jest.useFakeTimers();
    const reportedIssueShowSpy = jest.spyOn(snackbars.reportedIssueSent, "show").mockImplementation(() => Promise.resolve());
    const reportedIssueHideSpy = jest.spyOn(snackbars.reportedIssueSent, "hide").mockImplementation(() => Promise.resolve());
    const errorShowSpy = jest.spyOn(snackbars.errors, "show").mockImplementation(() => Promise.resolve());

    (post as jest.Mock).mockResolvedValue({});

    const promise = postCorrection(sampleCorrectionData);

    expect(reportedIssueShowSpy).toHaveBeenCalledWith(
      `Posted correction on ${sampleCorrectionData.ref}: ${sampleCorrectionData.userText}`,
      [],
    );
    expect(post).toHaveBeenCalledWith("/corrections", expect.objectContaining({
      ref: sampleCorrectionData.ref,
      userText: sampleCorrectionData.userText,
      isAiEdit: true,
    }));

    await Promise.resolve();
    expect(trackEvent).toHaveBeenCalledWith("event", "report_correction", {ref: sampleCorrectionData.ref});
    expect(reportedIssueHideSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2000);
    await promise;

    expect(reportedIssueHideSpy).toHaveBeenCalledTimes(1);
    expect(errorShowSpy).not.toHaveBeenCalled();

    reportedIssueShowSpy.mockRestore();
    reportedIssueHideSpy.mockRestore();
    errorShowSpy.mockRestore();
    jest.useRealTimers();
  });

  test("shows error in UI with dismiss button when posting fails", async () => {
    jest.useFakeTimers();
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const reportedIssueShowSpy = jest.spyOn(snackbars.reportedIssueSent, "show").mockImplementation(() => Promise.resolve());
    const reportedIssueHideSpy = jest.spyOn(snackbars.reportedIssueSent, "hide").mockImplementation(() => Promise.resolve());
    const errorShowSpy = jest.spyOn(snackbars.errors, "show").mockImplementation(() => Promise.resolve());
    const errorHideSpy = jest.spyOn(snackbars.errors, "hide").mockImplementation(() => Promise.resolve());

    (post as jest.Mock).mockRejectedValue(new Error("Network failure"));

    await postCorrection(sampleCorrectionData);

    expect(reportedIssueHideSpy).toHaveBeenCalledTimes(1);
    expect(errorShowSpy).toHaveBeenCalledWith(
      `Failed to post correction on ${sampleCorrectionData.ref}`,
      expect.anything(),
    );

    const buttons = errorShowSpy.mock.calls[0][1] as Button[];
    expect(buttons.length).toBe(1);
    expect(buttons[0].text).toBe("Dismiss");

    expect(errorHideSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(CORRECTION_ERROR_AUTO_DISMISS_DELAY_MILLISECONDS);
    expect(errorHideSpy).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
    reportedIssueShowSpy.mockRestore();
    reportedIssueHideSpy.mockRestore();
    errorShowSpy.mockRestore();
    errorHideSpy.mockRestore();
    jest.useRealTimers();
  });

  test("clicking dismiss button cancels automatic dismissal timer", async () => {
    jest.useFakeTimers();
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const errorShowSpy = jest.spyOn(snackbars.errors, "show").mockImplementation(() => Promise.resolve());
    const errorHideSpy = jest.spyOn(snackbars.errors, "hide").mockImplementation(() => Promise.resolve());

    (post as jest.Mock).mockRejectedValue(new Error("Server error"));

    await postCorrection(sampleCorrectionData);

    const buttons = errorShowSpy.mock.calls[0][1] as Button[];
    buttons[0].onClick();

    expect(errorHideSpy).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(CORRECTION_ERROR_AUTO_DISMISS_DELAY_MILLISECONDS);
    expect(errorHideSpy).toHaveBeenCalledTimes(1);

    consoleErrorSpy.mockRestore();
    errorShowSpy.mockRestore();
    errorHideSpy.mockRestore();
    jest.useRealTimers();
  });

  test("uses Hebrew text for error message and dismiss button when site language is Hebrew", async () => {
    localStorage.languageOption = "hebrew";
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const errorShowSpy = jest.spyOn(snackbars.errors, "show").mockImplementation(() => Promise.resolve());

    (post as jest.Mock).mockRejectedValue(new Error("Server error"));

    await postCorrection(sampleCorrectionData);

    expect(errorShowSpy).toHaveBeenCalledWith(
      `שגיאה בשליחת תיקון של ${sampleCorrectionData.ref}`,
      expect.anything(),
    );

    const buttons = errorShowSpy.mock.calls[0][1] as Button[];
    expect(buttons[0].text).toBe("סגור");

    consoleErrorSpy.mockRestore();
    errorShowSpy.mockRestore();
  });
});
