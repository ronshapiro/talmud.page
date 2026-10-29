import {postCorrection} from "../corrections";
import {postWithRetry} from "../post";
import {Button, snackbars} from "../snackbar";
import {trackEvent} from "../analytics";

jest.mock("../post", () => ({postWithRetry: jest.fn()}));
jest.mock("../analytics", () => ({trackEvent: jest.fn()}));

beforeEach(() => {
  localStorage.clear();
  (postWithRetry as jest.Mock).mockReset();
  (trackEvent as jest.Mock).mockReset();
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

  test("shows initial status with dismiss button and hides after success", async () => {
    jest.useFakeTimers();
    const reportedIssueShowSpy = jest.spyOn(snackbars.reportedIssueSent, "show").mockImplementation(() => Promise.resolve());
    const reportedIssueHideSpy = jest.spyOn(snackbars.reportedIssueSent, "hide").mockImplementation(() => Promise.resolve());

    (postWithRetry as jest.Mock).mockResolvedValue({});

    const promise = postCorrection(sampleCorrectionData);

    expect(reportedIssueShowSpy).toHaveBeenCalledWith(
      `Posted correction on ${sampleCorrectionData.ref}: ${sampleCorrectionData.userText}`,
      expect.anything(),
    );

    const buttons = reportedIssueShowSpy.mock.calls[0][1] as Button[];
    expect(buttons.length).toBe(1);
    expect(buttons[0].text).toBe("Dismiss");

    expect(postWithRetry).toHaveBeenCalledWith(
      "/corrections",
      expect.objectContaining({
        ref: sampleCorrectionData.ref,
        userText: sampleCorrectionData.userText,
        isAiEdit: true,
      }),
      expect.objectContaining({
        onError: expect.any(Function),
      }),
    );

    await Promise.resolve();
    expect(trackEvent).toHaveBeenCalledWith("event", "report_correction", {ref: sampleCorrectionData.ref});
    expect(reportedIssueHideSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(2000);
    await promise;

    expect(reportedIssueHideSpy).toHaveBeenCalledTimes(1);

    reportedIssueShowSpy.mockRestore();
    reportedIssueHideSpy.mockRestore();
    jest.useRealTimers();
  });

  test("shows Hebrew dismiss button and text when site language is Hebrew", async () => {
    localStorage.languageOption = "hebrew";
    const reportedIssueShowSpy = jest.spyOn(snackbars.reportedIssueSent, "show").mockImplementation(() => Promise.resolve());

    (postWithRetry as jest.Mock).mockResolvedValue({});

    postCorrection(sampleCorrectionData);

    expect(reportedIssueShowSpy).toHaveBeenCalledWith(
      `תיקון של ${sampleCorrectionData.ref} נשלח`,
      expect.anything(),
    );

    const buttons = reportedIssueShowSpy.mock.calls[0][1] as Button[];
    expect(buttons.length).toBe(1);
    expect(buttons[0].text).toBe("סגור");

    reportedIssueShowSpy.mockRestore();
  });

  test("appends previous error to original snackbar on failure and updates in place without using errors snackbar", async () => {
    const reportedIssueShowSpy = jest.spyOn(snackbars.reportedIssueSent, "show").mockImplementation(() => Promise.resolve());
    const reportedIssueUpdateSpy = jest.spyOn(snackbars.reportedIssueSent, "update").mockImplementation(() => {});
    const errorsShowSpy = jest.spyOn(snackbars.errors, "show").mockImplementation(() => Promise.resolve());

    let capturedOnError: (
      (errorMessage: string | undefined, errorResponse: unknown) => void
    ) | undefined;
    (postWithRetry as jest.Mock).mockImplementation((_endpoint, _data, options) => {
      capturedOnError = options?.onError;
      return new Promise(() => {});
    });

    postCorrection(sampleCorrectionData);

    expect(capturedOnError).toBeDefined();
    capturedOnError!("Internal Server Error", {status: 500});

    expect(reportedIssueUpdateSpy).toHaveBeenCalledWith(
      `Posted correction on ${sampleCorrectionData.ref}: ${sampleCorrectionData.userText}<br>Internal Server Error`,
      expect.anything(),
    );
    expect(errorsShowSpy).not.toHaveBeenCalled();

    reportedIssueShowSpy.mockRestore();
    reportedIssueUpdateSpy.mockRestore();
    errorsShowSpy.mockRestore();
  });

  test("clicking dismiss button hides snackbar and prevents subsequent retry errors from reshowing snackbar", async () => {
    const reportedIssueShowSpy = jest.spyOn(snackbars.reportedIssueSent, "show").mockImplementation(() => Promise.resolve());
    const reportedIssueUpdateSpy = jest.spyOn(snackbars.reportedIssueSent, "update").mockImplementation(() => {});
    const reportedIssueHideSpy = jest.spyOn(snackbars.reportedIssueSent, "hide").mockImplementation(() => Promise.resolve());

    let capturedOnError: (
      (errorMessage: string | undefined, errorResponse: unknown) => void
    ) | undefined;
    (postWithRetry as jest.Mock).mockImplementation((_endpoint, _data, options) => {
      capturedOnError = options?.onError;
      return new Promise(() => {});
    });

    postCorrection(sampleCorrectionData);

    const buttons = reportedIssueShowSpy.mock.calls[0][1] as Button[];
    buttons[0].onClick();

    expect(reportedIssueHideSpy).toHaveBeenCalledTimes(1);

    capturedOnError!("Network failure", {});

    expect(reportedIssueUpdateSpy).not.toHaveBeenCalled();

    reportedIssueShowSpy.mockRestore();
    reportedIssueUpdateSpy.mockRestore();
    reportedIssueHideSpy.mockRestore();
  });
});
