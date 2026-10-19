import {addDriveComments} from "../addDriveComments";
import {page, segment, comment} from "./testing/fixtures";
import {HighlightCommentWithText} from "../google_drive/types";

function highlightOf(text: string, isEnglish = false): HighlightCommentWithText {
  return {
    highlight: "yellow",
    text,
    commentSourceMetadata: {
      startPercentage: 0,
      endPercentage: 1,
      wordCountStart: 0,
      wordCountEnd: 0,
      isEnglish,
    },
  };
}

describe("addDriveComments", () => {
  test("does not apply highlights to Model subcomments", () => {
    const modelComment = comment({
      ref: "Rashi on Berakhot 2a:1-model",
      he: "gemini-model-output",
      en: "gemini-model-output",
      sourceRef: "Model",
      sourceHeRef: "מודל",
    });
    const rashiComment = comment({
      ref: "Rashi on Berakhot 2a:1",
      he: "שלום עולם",
      en: "hello world",
      commentary: {
        Model: {
          comments: [modelComment],
        },
      },
    });
    const targetPage = page({
      id: "2a",
      sections: [
        segment({
          ref: "Berakhot 2a:1",
          he: "ברכות",
          en: "Blessings",
          commentary: {
            Rashi: {
              comments: [rashiComment],
            },
          },
        }),
      ],
    });

    const fakeDriveClient = {
      commentsForRef: () => undefined,
      highlightsForRef: (ref: string) => {
        if (ref === "Rashi on Berakhot 2a:1") {
          return [highlightOf("עולם")];
        }
        if (ref === "Rashi on Berakhot 2a:1-model") {
          return [highlightOf("gemini")];
        }
        return [];
      },
    } as any;

    addDriveComments([targetPage], fakeDriveClient);

    expect(rashiComment.he).toContain("<span-highlight");
    expect(rashiComment.unhighlighted).toEqual({he: "שלום עולם", en: "hello world"});

    expect(modelComment.he).toBe("gemini-model-output");
    expect(modelComment.en).toBe("gemini-model-output");
    expect(modelComment.unhighlighted).toBeUndefined();
    expect(modelComment.highlightColors).toBeUndefined();
  });
});
