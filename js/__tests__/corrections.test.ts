import {postCorrection} from "../corrections";
import {postWithRetry} from "../post";
import {snackbars} from "../snackbar";
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

  test("shows initial status and hides after success", async () => {
    jest.useFakeTimers();
    const reportedIssueShowSpy = jest.spyOn(snackbars.reportedIssueSent, "show").mockImplementation(() => Promise.resolve());
    const reportedIssueHideSpy = jest.spyOn(snackbars.reportedIssueSent, "hide").mockImplementation(() => Promise.resolve());

    (postWithRetry as jest.Mock).mockResolvedValue({});

    const promise = postCorrection(sampleCorrectionData);

    expect(reportedIssueShowSpy).toHaveBeenCalledWith(
      `Posted correction on ${sampleCorrectionData.ref}: ${sampleCorrectionData.userText}`,
      [],
    );
    expect(postWithRetry).toHaveBeenCalledWith("/corrections", expect.objectContaining({
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

    reportedIssueShowSpy.mockRestore();
    reportedIssueHideSpy.mockRestore();
    jest.useRealTimers();
  });

  test("shows Hebrew status text when site language is Hebrew", async () => {
    localStorage.languageOption = "hebrew";
    const reportedIssueShowSpy = jest.spyOn(snackbars.reportedIssueSent, "show").mockImplementation(() => Promise.resolve());

    (postWithRetry as jest.Mock).mockResolvedValue({});

    postCorrection(sampleCorrectionData);

    expect(reportedIssueShowSpy).toHaveBeenCalledWith(
      `תיקון של ${sampleCorrectionData.ref} נשלח`,
      [],
    );

    reportedIssueShowSpy.mockRestore();
  });
});
