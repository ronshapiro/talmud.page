import {promoteReplaceableAiComments} from "../promote_replaceable_ai_comments";
import {AI_EDIT_COMMENT_NAME} from "../commentary_constants";
import {UiPage} from "../Page";
import {commentaries, comment, page, resetFixtureCounter, segment} from "./testing/fixtures";

beforeEach(resetFixtureCounter);

function aiVersion(overrides = {}) {
  return comment({
    ref: "ai-ref",
    he: "עברית של הבינה",
    en: "ai english",
    sourceRef: AI_EDIT_COMMENT_NAME,
    sourceHeRef: AI_EDIT_COMMENT_NAME,
    canReplaceParent: true,
    ...overrides,
  });
}

function pageWithRashi(rashiOverrides = {}): UiPage {
  return page({
    sections: [segment({
      commentary: commentaries({
        Rashi: [{
          ref: "Rashi 1",
          he: "עברית מקורית",
          en: "original english",
          commentary: {Versions: {comments: [aiVersion()]}},
          ...rashiOverrides,
        }],
      }),
    })],
  });
}

const rashiOf = (target: UiPage) => target.sections[0].commentary!.Rashi.comments[0];
const versionsOf = (target: UiPage) => rashiOf(target).commentary!.Versions.comments;

test("an AI version that can replace its parent is promoted into the parent", () => {
  const target = pageWithRashi();

  promoteReplaceableAiComments(target);

  expect(rashiOf(target).he).toBe("עברית של הבינה");
  expect(rashiOf(target).en).toBe("ai english");
  expect(rashiOf(target).didModifyUiWithAiVersion).toBe(true);
});

test("the displaced original text is kept as an 'Original Text' version", () => {
  const target = pageWithRashi();

  promoteReplaceableAiComments(target);

  const [original] = versionsOf(target);
  expect(original.sourceRef).toBe("Original Text");
  expect(original.sourceHeRef).toBe("מקורי");
  expect(original.he).toBe("עברית מקורית");
  expect(original.en).toBe("original english");
});

test("promotion is idempotent, since it runs on every render", () => {
  const target = pageWithRashi();

  promoteReplaceableAiComments(target);
  const afterFirst = {he: rashiOf(target).he, en: rashiOf(target).en};
  promoteReplaceableAiComments(target);

  expect({he: rashiOf(target).he, en: rashiOf(target).en}).toEqual(afterFirst);
  expect(versionsOf(target)[0].sourceRef).toBe("Original Text");
  expect(versionsOf(target)[0].he).toBe("עברית מקורית");
});

test("canReplaceParent is cleared so the swap is not repeated", () => {
  const target = pageWithRashi();

  promoteReplaceableAiComments(target);

  expect(versionsOf(target)[0].canReplaceParent).toBeUndefined();
});

test("an AI version without canReplaceParent is left alone", () => {
  const target = page({
    sections: [segment({
      commentary: commentaries({
        Rashi: [{
          ref: "Rashi 1",
          he: "עברית מקורית",
          commentary: {Versions: {comments: [aiVersion({canReplaceParent: undefined})]}},
        }],
      }),
    })],
  });

  promoteReplaceableAiComments(target);

  expect(rashiOf(target).he).toBe("עברית מקורית");
  expect(rashiOf(target).didModifyUiWithAiVersion).toBeUndefined();
  expect(versionsOf(target)[0].sourceRef).toBe(AI_EDIT_COMMENT_NAME);
});

test("a non-AI version is never promoted, even with canReplaceParent", () => {
  const target = page({
    sections: [segment({
      commentary: commentaries({
        Rashi: [{
          ref: "Rashi 1",
          he: "עברית מקורית",
          commentary: {
            Versions: {
              comments: [comment({sourceRef: "Vilna Shas", he: "אחר", canReplaceParent: true})],
            },
          },
        }],
      }),
    })],
  });

  promoteReplaceableAiComments(target);

  expect(rashiOf(target).he).toBe("עברית מקורית");
});

test("promotion recurses into nested commentaries", () => {
  const target = page({
    sections: [segment({
      commentary: commentaries({
        Rashi: [{
          ref: "Rashi 1",
          commentary: commentaries({
            Verses: [{
              ref: "Genesis 1:1",
              he: "עברית מקורית",
              en: "original english",
              commentary: {Versions: {comments: [aiVersion()]}},
            }],
          }),
        }],
      }),
    })],
  });

  promoteReplaceableAiComments(target);

  const verse = rashiOf(target).commentary!.Verses.comments[0];
  expect(verse.he).toBe("עברית של הבינה");
  expect(verse.didModifyUiWithAiVersion).toBe(true);
});

test("segments themselves are not promoted, only their commentaries", () => {
  // There is an explicit TODO in the source about supporting this; this test pins the current
  // behavior so the TODO's status stays visible.
  const target = page({
    sections: [segment({
      he: "עברית מקורית",
      commentary: {Versions: {comments: [aiVersion()]}},
    })],
  });

  promoteReplaceableAiComments(target);

  expect(target.sections[0].he).toBe("עברית מקורית");
  // The flag is only declared on comments, not segments — which is itself part of the TODO.
  expect((target.sections[0] as any).didModifyUiWithAiVersion).toBeUndefined();
});

test("a page with no commentary at all is left untouched", () => {
  const target = page({sections: [segment({he: "עברית"})]});

  expect(() => promoteReplaceableAiComments(target)).not.toThrow();
  expect(target.sections[0].he).toBe("עברית");
});

test("pendingReview is transferred from AI version to parent comment on promotion", () => {
  const target = pageWithRashi({
    commentary: {
      Versions: {
        comments: [aiVersion({pendingReview: "Menachot 87b"})],
      },
    },
  });

  promoteReplaceableAiComments(target);

  expect(rashiOf(target).pendingReview).toBe("Menachot 87b");
  expect(versionsOf(target)[0].pendingReview).toBeUndefined();
});

test("Model commentary is transferred from AI version to parent comment on promotion", () => {
  const modelSubcomment = comment({
    ref: "ai-ref-model",
    he: "claude-sonnet-5",
    en: "claude-sonnet-5",
    sourceRef: "Model",
  });
  const target = pageWithRashi({
    commentary: {
      Versions: {
        comments: [aiVersion({
          commentary: {
            Model: {comments: [modelSubcomment]},
          },
        })],
      },
    },
  });

  promoteReplaceableAiComments(target);

  expect(rashiOf(target).commentary!.Model.comments).toEqual([modelSubcomment]);
  expect(versionsOf(target)[0].commentary?.Model).toBeUndefined();
});

test("an AI version that only adds English is inlined into the parent comment", () => {
  const target = page({
    sections: [segment({
      commentary: commentaries({
        Rashi: [{
          ref: "Rashi 1",
          he: "עברית מקורית",
          en: "",
          commentary: {
            Versions: {
              comments: [aiVersion({
                he: "",
                en: "ai english",
                canReplaceParent: false,
              })],
            },
          },
        }],
      }),
    })],
  });

  promoteReplaceableAiComments(target);

  const rashi = rashiOf(target);
  expect(rashi.he).toBe("עברית מקורית");
  expect(rashi.en).toBe("ai english");
  expect(rashi.didModifyUiWithAiVersion).toBe(true);
  expect(rashi.aiModifiedHebrew).toBe(false);
  expect(rashi.aiModifiedEnglish).toBe(true);
  expect(rashi.commentary?.Versions).toBeUndefined();
});

test("an AI version that only adds English to a comment with existing English preserves original text", () => {
  const target = page({
    sections: [segment({
      commentary: commentaries({
        Rashi: [{
          ref: "Rashi 1",
          he: "עברית מקורית",
          en: "original english",
          commentary: {
            Versions: {
              comments: [aiVersion({
                he: "",
                en: "ai english",
                canReplaceParent: false,
              })],
            },
          },
        }],
      }),
    })],
  });

  promoteReplaceableAiComments(target);

  const rashi = rashiOf(target);
  expect(rashi.he).toBe("עברית מקורית");
  expect(rashi.en).toBe("ai english");
  expect(rashi.didModifyUiWithAiVersion).toBe(true);
  expect(rashi.aiModifiedHebrew).toBe(false);
  expect(rashi.aiModifiedEnglish).toBe(true);

  const [original] = versionsOf(target);
  expect(original.sourceRef).toBe("Original Text");
  expect(original.sourceHeRef).toBe("מקורי");
  expect(original.he).toBe("עברית מקורית");
  expect(original.en).toBe("original english");
});

test("an AI version that only adds English transfers pendingReview to parent comment", () => {
  const target = page({
    sections: [segment({
      commentary: commentaries({
        Rashi: [{
          ref: "Rashi 1",
          he: "עברית מקורית",
          en: "",
          commentary: {
            Versions: {
              comments: [aiVersion({
                he: "",
                en: "ai english",
                canReplaceParent: false,
                pendingReview: "Menachot 87a",
              })],
            },
          },
        }],
      }),
    })],
  });

  promoteReplaceableAiComments(target);

  expect(rashiOf(target).pendingReview).toBe("Menachot 87a");
});

test("an AI version that only adds English transfers Model commentary to parent comment", () => {
  const modelSubcomment = comment({
    ref: "ai-ref-model",
    he: "claude-sonnet-5",
    en: "claude-sonnet-5",
    sourceRef: "Model",
  });
  const target = page({
    sections: [segment({
      commentary: commentaries({
        Rashi: [{
          ref: "Rashi 1",
          he: "עברית מקורית",
          en: "",
          commentary: {
            Versions: {
              comments: [aiVersion({
                he: "",
                en: "ai english",
                canReplaceParent: false,
                commentary: {
                  Model: {comments: [modelSubcomment]},
                },
              })],
            },
          },
        }],
      }),
    })],
  });

  promoteReplaceableAiComments(target);

  expect(rashiOf(target).commentary!.Model.comments).toEqual([modelSubcomment]);
  expect(rashiOf(target).commentary?.Versions).toBeUndefined();
});

test("promotion of English-only AI addition is idempotent", () => {
  const target = page({
    sections: [segment({
      commentary: commentaries({
        Rashi: [{
          ref: "Rashi 1",
          he: "עברית מקורית",
          en: "",
          commentary: {
            Versions: {
              comments: [aiVersion({
                he: "",
                en: "ai english",
                canReplaceParent: false,
              })],
            },
          },
        }],
      }),
    })],
  });

  promoteReplaceableAiComments(target);
  const afterFirst = {he: rashiOf(target).he, en: rashiOf(target).en};
  promoteReplaceableAiComments(target);

  expect({he: rashiOf(target).he, en: rashiOf(target).en}).toEqual(afterFirst);
  expect(rashiOf(target).commentary?.Versions).toBeUndefined();
});

test("replacing Hebrew and adding English sets both aiModifiedHebrew and aiModifiedEnglish to true", () => {
  const target = pageWithRashi();

  promoteReplaceableAiComments(target);

  expect(rashiOf(target).aiModifiedHebrew).toBe(true);
  expect(rashiOf(target).aiModifiedEnglish).toBe(true);
});

test("replacing Hebrew without English sets aiModifiedHebrew to true and aiModifiedEnglish to false", () => {
  const target = pageWithRashi({
    commentary: {
      Versions: {
        comments: [aiVersion({
          he: "עברית של הבינה",
          en: "",
          canReplaceParent: true,
        })],
      },
    },
  });

  promoteReplaceableAiComments(target);

  expect(rashiOf(target).aiModifiedHebrew).toBe(true);
  expect(rashiOf(target).aiModifiedEnglish).toBe(false);
});
