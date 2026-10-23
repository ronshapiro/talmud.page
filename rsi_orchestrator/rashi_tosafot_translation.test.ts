import * as contextUsageLog from "../precomputed/rsi_state/context_usage_log";
import * as generationRecordModule from "../precomputed/rsi_state/generation_record";
import * as modelRouting from "../precomputed/rsi_state/model_routing";
import * as pageSkeleton from "../precomputed/rsi_state/page_skeleton";
import {Edit} from "../precomputed/ai_edits";
import * as agentRunner from "./agent_runner";
import * as contextFetch from "./context_fetch";
import {AgentError} from "./agent_runner";
import {
  CritiqueOutcome,
  CritiqueVerdict,
  critiquePrompt,
  critiqueViaAgent,
  extractHebrewWordsForVerification,
  generationPrompt,
  targetComment,
  GeneratedEdit,
  generateViaAgent,
  generateWithSelfCritique,
  isFreshTranslation,
  TASK_TYPE,
  recordGenerationForCandidate,
  compareAmudim,
  filterSectionsFromStartPage,
  MAX_GENERATION_ATTEMPTS,
  parseJsonResponse,
  runContinuousTranslation,
  TranslationCandidate,
  TranslationDeps,
  translateRashiTosafotComments,
  verifyProposedHebrewWording,
} from "./rashi_tosafot_translation";

function candidate(overrides: Partial<TranslationCandidate> = {}): TranslationCandidate {
  return {
    page: "Zevachim 2a",
    book: "Zevachim",
    section: "2a",
    ref: "Rashi on Zevachim 2a:1:1",
    commentator: "Rashi",
    hebrewSource: "מקור",
    ...overrides,
  };
}

function generated(overrides: Partial<GeneratedEdit> = {}): GeneratedEdit {
  return {
    edit: {hebrew: "מקור.", english: "source"},
    model: "claude-sonnet-5",
    costUsd: 0.01,
    contextRefsUsed: [],
    ...overrides,
  };
}

function outcome(overrides: Partial<CritiqueOutcome> = {}): CritiqueOutcome {
  return {
    verdict: {valid: true, reason: "looks good"},
    costUsd: 0.002,
    contextRefsUsed: [],
    ...overrides,
  };
}

const validOutcome = outcome();
const invalidVerdict: CritiqueVerdict = {valid: false, reason: "changed a word"};
const invalidOutcome = outcome({verdict: invalidVerdict});

describe("generateWithSelfCritique", () => {
  test("returns the edit when the first critique passes", async () => {
    const generate = jest.fn(async () => generated());
    const critique = jest.fn(async () => validOutcome);
    const result = await generateWithSelfCritique(candidate(), {generate, critique});
    // costUsd is the sum of the generate + critique calls (0.01 + 0.002), not just generate's own.
    expect(result).toEqual(generated({costUsd: 0.012}));
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test("sums cost across the generate and critique calls", async () => {
    const generate = jest.fn(async () => generated({costUsd: 0.03}));
    const critique = jest.fn(async () => outcome({costUsd: 0.005}));
    const result = await generateWithSelfCritique(candidate(), {generate, critique});
    expect(result!.costUsd).toBeCloseTo(0.035);
  });

  test("retries once with feedback when the first critique fails, then succeeds", async () => {
    const generate = jest.fn<Promise<GeneratedEdit>, [TranslationCandidate, string?]>()
      .mockResolvedValueOnce(generated({edit: {hebrew: "מקור.", english: "wrong"}, costUsd: 0.01}))
      .mockResolvedValueOnce(generated({costUsd: 0.01}));
    const critique = jest.fn<Promise<CritiqueOutcome>, [TranslationCandidate, Edit]>()
      .mockResolvedValueOnce(outcome({verdict: invalidVerdict, costUsd: 0.002}))
      .mockResolvedValueOnce(outcome({costUsd: 0.002}));

    const result = await generateWithSelfCritique(candidate(), {generate, critique});

    expect(result).toEqual(generated({costUsd: 0.024}));
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1]).toEqual([candidate(), invalidVerdict.reason]);
  });

  test("unions contextRefsUsed from the accepted generate and critique calls", async () => {
    const generate = jest.fn(async () => generated({contextRefsUsed: ["Zevachim 2a:1"]}));
    const critique = jest.fn(async () => outcome({
      contextRefsUsed: ["Zevachim 2a:1", "Rashi on Zevachim 2a:1:2"],
    }));
    const result = await generateWithSelfCritique(candidate(), {generate, critique});
    expect(result!.contextRefsUsed.sort()).toEqual(["Rashi on Zevachim 2a:1:2", "Zevachim 2a:1"]);
  });

  test("only counts the final accepted attempt's contextRefsUsed, not the rejected one's", async () => {
    const generate = jest.fn<Promise<GeneratedEdit>, [TranslationCandidate, string?]>()
      .mockResolvedValueOnce(generated({
        edit: {hebrew: "מקור.", english: "wrong"}, contextRefsUsed: ["Zevachim 2a:99"],
      }))
      .mockResolvedValueOnce(generated({contextRefsUsed: ["Zevachim 2a:1"]}));
    const critique = jest.fn<Promise<CritiqueOutcome>, [TranslationCandidate, Edit]>()
      .mockResolvedValueOnce(outcome({verdict: invalidVerdict, contextRefsUsed: []}))
      .mockResolvedValueOnce(outcome({contextRefsUsed: []}));

    const result = await generateWithSelfCritique(candidate(), {generate, critique});

    expect(result!.contextRefsUsed).toEqual(["Zevachim 2a:1"]);
  });

  test(`retries up to ${MAX_GENERATION_ATTEMPTS} times, then gives up`, async () => {
    const generate = jest.fn(async () => generated({edit: {hebrew: "מקור.", english: "wrong"}}));
    const critique = jest.fn(async () => invalidOutcome);

    const result = await generateWithSelfCritique(candidate(), {generate, critique});

    expect(result).toBeUndefined();
    expect(generate).toHaveBeenCalledTimes(MAX_GENERATION_ATTEMPTS);
    expect(critique).toHaveBeenCalledTimes(MAX_GENERATION_ATTEMPTS);
  });

  test("succeeds on the final allowed attempt rather than giving up early", async () => {
    const generate = jest.fn(async () => generated({edit: {hebrew: "מקור.", english: "wrong"}}));
    const critique = jest.fn<Promise<CritiqueOutcome>, [TranslationCandidate, Edit]>();
    for (let i = 0; i < MAX_GENERATION_ATTEMPTS - 1; i++) {
      critique.mockResolvedValueOnce(invalidOutcome);
    }
    critique.mockResolvedValueOnce(validOutcome);

    const result = await generateWithSelfCritique(candidate(), {generate, critique});

    expect(result).not.toBeUndefined();
    expect(generate).toHaveBeenCalledTimes(MAX_GENERATION_ATTEMPTS);
  });

  test("retries with feedback when generate throws (e.g. a malformed response), not just on a "
    + "rejected critique", async () => {
    const generate = jest.fn<Promise<GeneratedEdit>, [TranslationCandidate, string?]>()
      .mockRejectedValueOnce(new SyntaxError("Unexpected token"))
      .mockResolvedValueOnce(generated());
    const critique = jest.fn(async () => validOutcome);

    const result = await generateWithSelfCritique(candidate(), {generate, critique});

    expect(result).not.toBeUndefined();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(critique).toHaveBeenCalledTimes(1); // not called for the attempt that threw
    expect(generate.mock.calls[1][1]).toContain("Unexpected token");
  });

  test("propagates a rate-limit error immediately instead of retrying", async () => {
    const rateLimitError = new AgentError("rate limited", 429, "claude");
    const generate = jest.fn(async () => { throw rateLimitError; });
    const critique = jest.fn(async () => validOutcome);

    await expect(generateWithSelfCritique(candidate(), {generate, critique}))
      .rejects.toBe(rateLimitError);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test("accepts a terse verdict without reason", async () => {
    const generate = jest.fn(async () => generated());
    const critique = jest.fn(async () => outcome({verdict: {valid: true}}));
    const result = await generateWithSelfCritique(candidate(), {generate, critique});
    expect(result).not.toBeUndefined();
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test("retries with fallback reason when terse rejection omits reason", async () => {
    const generate = jest.fn<Promise<GeneratedEdit>, [TranslationCandidate, string?]>()
      .mockResolvedValueOnce(generated({edit: {hebrew: "מקור.", english: "wrong"}}))
      .mockResolvedValueOnce(generated());
    const critique = jest.fn<Promise<CritiqueOutcome>, [TranslationCandidate, Edit]>()
      .mockResolvedValueOnce(outcome({verdict: {valid: false}}))
      .mockResolvedValueOnce(outcome({verdict: {valid: true}}));

    const result = await generateWithSelfCritique(candidate(), {generate, critique});

    expect(result).not.toBeUndefined();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1][1]).toBe("Critique rejected the edit");
  });

  test("propagates a cancelled error immediately without retrying", async () => {
    const cancelledErr = new AgentError("Execution cancelled", undefined, "agy", true);
    const generate = jest.fn(async () => { throw cancelledErr; });
    const critique = jest.fn(async () => validOutcome);

    await expect(generateWithSelfCritique(candidate(), {generate, critique}))
      .rejects.toBe(cancelledErr);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  test("returns undefined immediately when shouldStop returns true", async () => {
    const generate = jest.fn(async () => generated());
    const critique = jest.fn(async () => validOutcome);
    const result = await generateWithSelfCritique(candidate(), {
      generate,
      critique,
      shouldStop: () => true,
    });
    expect(result).toBeUndefined();
    expect(generate).not.toHaveBeenCalled();
  });

  test("skips critique and retries on CPU check rejection when Hebrew wording is modified", async () => {
    const generate = jest.fn<Promise<GeneratedEdit>, [TranslationCandidate, string?]>()
      .mockResolvedValueOnce(generated({edit: {hebrew: "מילה אחרת", english: "different"}, costUsd: 0.01}))
      .mockResolvedValueOnce(generated({edit: {hebrew: "מקור:", english: "source"}, costUsd: 0.01}));
    const critique = jest.fn<Promise<CritiqueOutcome>, [TranslationCandidate, Edit]>()
      .mockResolvedValueOnce(validOutcome);

    const result = await generateWithSelfCritique(
      candidate({hebrewSource: "מקור"}), {generate, critique});

    expect(result).not.toBeUndefined();
    expect(generate).toHaveBeenCalledTimes(2);
    // Critique should only be called once, for the second attempt, not the CPU-rejected first
    expect(critique).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[1][1]).toContain(
      "Proposed Hebrew modified the source text outside of <span class=\"explanation\">");
  });

  test("accepts valid abbreviation expansions and explanations through CPU check", async () => {
    const sourceHebrew = 'מתני\' כ"א תקיעות מפרש להו בפ\' החליל אא"כ פירש';
    const proposedHebrew = '<strong class="dibur-hamatchil">מתני\'</strong> - '
      + 'כ"א תקיעות, <span class="explanation">הגמרא</span> '
      + 'מפרש להו <abbr title="בפרק">בפ\'</abbr> החליל, <abbr title="אלא אם כן">אא"כ</abbr> פירש:';
    const generate = jest.fn(async () => generated({
      edit: {hebrew: proposedHebrew, english: "The Mishnah explains"},
    }));
    const critique = jest.fn(async () => validOutcome);

    const result = await generateWithSelfCritique(
      candidate({hebrewSource: sourceHebrew}), {generate, critique});

    expect(result).not.toBeUndefined();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(critique).toHaveBeenCalledTimes(1);
  });
});

describe("verifyProposedHebrewWording", () => {
  const sourceHebrew = 'מתני\' כ"א תקיעות מפרש להו בפ\' החליל';

  test("accepts valid punctuation additions with unchanged Hebrew wording", () => {
    const proposedHebrew = '<strong class="dibur-hamatchil">מתני\'</strong> - כ"א תקיעות, מפרש להו בפ\' החליל:';
    const verification = verifyProposedHebrewWording(sourceHebrew, proposedHebrew);
    expect(verification.valid).toBe(true);
  });

  test("accepts valid <abbr title=\"...\"> abbreviation expansions", () => {
    const proposedHebrew = '<strong class="dibur-hamatchil">מתני\'</strong> - '
      + '<abbr title="עשרים ואחת">כ"א</abbr> תקיעות, מפרש להו <abbr title="בפרק">בפ\'</abbr> החליל:';
    const verification = verifyProposedHebrewWording(sourceHebrew, proposedHebrew);
    expect(verification.valid).toBe(true);
  });

  test("accepts valid <span class=\"explanation\">...</span> contextual additions", () => {
    const proposedHebrew = '<strong class="dibur-hamatchil">מתני\'</strong> - '
      + 'כ"א תקיעות, <span class="explanation">הגמרא</span> מפרש להו בפ\' החליל:';
    const verification = verifyProposedHebrewWording(sourceHebrew, proposedHebrew);
    expect(verification.valid).toBe(true);
  });

  test("accepts valid combination of <abbr> and <span class=\"explanation\">", () => {
    const proposedHebrew = '<strong class="dibur-hamatchil">מתני\'</strong> - '
      + '<abbr title="עשרים ואחת">כ"א</abbr> תקיעות, <span class="explanation">הגמרא</span> '
      + 'מפרש להו <abbr title="בפרק">בפ\'</abbr> החליל:';
    const verification = verifyProposedHebrewWording(sourceHebrew, proposedHebrew);
    expect(verification.valid).toBe(true);
  });

  test("rejects when Hebrew words are modified outside of explanations", () => {
    // Replaced בפ' with בפרק directly without keeping abbreviation inside <abbr>
    const proposedHebrew = '<strong class="dibur-hamatchil">מתני\'</strong> - כ"א תקיעות, מפרש להו בפרק החליל:';
    const verification = verifyProposedHebrewWording(sourceHebrew, proposedHebrew);
    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain(
      "Proposed Hebrew modified the source text outside of <span class=\"explanation\">");
  });

  test("rejects unclosed <span class=\"explanation\"> tags", () => {
    const proposedHebrew = 'מתני\' כ"א תקיעות <span class="explanation">הגמרא מפרש להו בפ\' החליל:';
    const verification = verifyProposedHebrewWording(sourceHebrew, proposedHebrew);
    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain('Unclosed <span class="explanation"> tag');
  });

  test("rejects mismatched <abbr> tags", () => {
    const proposedHebrew = '<abbr title="מתניתין">מתני\' כ"א תקיעות מפרש להו בפ\' החליל:';
    const verification = verifyProposedHebrewWording(sourceHebrew, proposedHebrew);
    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain("Mismatched <abbr> tags");
  });

  test("rejects <abbr> tags missing a title attribute", () => {
    const proposedHebrew = '<abbr>מתני\'</abbr> כ"א תקיעות מפרש להו בפ\' החליל:';
    const verification = verifyProposedHebrewWording(sourceHebrew, proposedHebrew);
    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain("Missing title attribute in <abbr> tag");
  });

  test("rejects <abbr> tags around וגו' and וכו' and כו'", () => {
    const proposedWithVegomer = 'מתני\' וגו\' מפרש להו בפ\' החליל';
    const invalidVegomer = '<abbr title="וגומר">וגו\'</abbr>';
    const verificationVegomer = verifyProposedHebrewWording(
      proposedWithVegomer, `מתני' ${invalidVegomer} מפרש להו בפ' החליל`);
    expect(verificationVegomer.valid).toBe(false);
    expect(verificationVegomer.reason).toContain("Do not wrap וגו', וכו'");

    const proposedWithVechulei = 'מתני\' וכו\' מפרש להו בפ\' החליל';
    const invalidVechulei = '<abbr title="וכולי">וכו\'</abbr>';
    const verificationVechulei = verifyProposedHebrewWording(
      proposedWithVechulei, `מתני' ${invalidVechulei} מפרש להו בפ' החליל`);
    expect(verificationVechulei.valid).toBe(false);
    expect(verificationVechulei.reason).toContain("Do not wrap וגו', וכו'");

    const proposedWithChulei = 'מתני\' כו\' מפרש להו בפ\' החליל';
    const invalidChulei = '<abbr title="כולי">כו\'</abbr>';
    const verificationChulei = verifyProposedHebrewWording(
      proposedWithChulei, `מתני' ${invalidChulei} מפרש להו בפ' החליל`);
    expect(verificationChulei.valid).toBe(false);
    expect(verificationChulei.reason).toContain("Do not wrap וגו', וכו'");
  });

  test("accepts <abbr> tags around opening section headers like מתני' or גמ' on cpu", () => {
    const sourceWithOpeningMishnah = "מתני' כ\"א תקיעות";
    const proposedOpeningMishnah = '<strong class="dibur-hamatchil"><abbr title="מתניתין">מתני\'</abbr></strong> - <abbr title="עשרים ואחת">כ"א</abbr> תקיעות:';
    const verificationOpeningMishnah = verifyProposedHebrewWording(
      sourceWithOpeningMishnah, proposedOpeningMishnah);
    expect(verificationOpeningMishnah.valid).toBe(true);

    const sourceWithOpeningGemara = "גמ' מנא הני מילי";
    const proposedOpeningGemara = '<strong class="dibur-hamatchil"><abbr title="גמרא">גמ\'</abbr></strong> - מנא הני מילי:';
    const verificationOpeningGemara = verifyProposedHebrewWording(
      sourceWithOpeningGemara, proposedOpeningGemara);
    expect(verificationOpeningGemara.valid).toBe(true);
  });

  test("accepts <abbr> tags around page or chapter reference numerals on cpu", () => {
    const sourceWithChapterNumeral = "כמו בההיא דפרק ד' אחין";
    const proposedChapterNumeral = 'כמו בההיא דפרק <abbr title="ארבעה">ד\'</abbr> אחין';
    const verificationChapterNumeral = verifyProposedHebrewWording(
      sourceWithChapterNumeral, proposedChapterNumeral);
    expect(verificationChapterNumeral.valid).toBe(true);

    const sourceWithPageNumeral = "כדאמרינן לקמן דף ב. ושם";
    const proposedPageNumeral = 'כדאמרינן לקמן דף <abbr title="שתים">ב.</abbr> ושם';
    const verificationPageNumeral = verifyProposedHebrewWording(
      sourceWithPageNumeral, proposedPageNumeral);
    expect(verificationPageNumeral.valid).toBe(true);
  });

  test("accepts <abbr> tags around ע\"ה for עליו השלום", () => {
    const sourceWithAlavHashalom = 'משה רבינו ע"ה אמר';
    const proposedWithAlavHashalom = 'משה רבינו <abbr title="עליו השלום">ע"ה</abbr> אמר:';
    const verification = verifyProposedHebrewWording(
      sourceWithAlavHashalom, proposedWithAlavHashalom);
    expect(verification.valid).toBe(true);
  });

  test("accepts <abbr> tags around regular numbers representing counts or quantities", () => {
    const sourceWithRegularNumeral = "שבעת ימים קודם ז' ימים כ\"א תקיעות ד' ראשי שנים";
    const validRegularNumeral = '<strong class="dibur-hamatchil">שבעת ימים</strong> - '
      + 'קודם <abbr title="שבעת">ז\'</abbr> ימים '
      + '<abbr title="עשרים ואחת">כ"א</abbr> תקיעות '
      + '<abbr title="ארבעה">ד\'</abbr> ראשי שנים:';
    const verificationRegularNumeral = verifyProposedHebrewWording(
      sourceWithRegularNumeral, validRegularNumeral);
    expect(verificationRegularNumeral.valid).toBe(true);
  });

  test("rejects <abbr> tags around הקב\"ה, רש\"י, or חז\"ל", () => {
    const sourceWithSacredName = 'שאמר להם הקב"ה ורש"י פירש';
    const invalidSacredName = 'שאמר להם <abbr title="הקדוש ברוך הוא">הקב"ה</abbr> ורש"י פירש:';
    const verificationSacredName = verifyProposedHebrewWording(
      sourceWithSacredName, invalidSacredName);
    expect(verificationSacredName.valid).toBe(false);
    expect(verificationSacredName.reason).toContain("Do not wrap וגו', וכו'");

    const invalidRashi = 'שאמר להם הקב"ה ו<abbr title="רבי שלמה יצחקי">רש"י</abbr> פירש:';
    const verificationRashi = verifyProposedHebrewWording(sourceWithSacredName, invalidRashi);
    expect(verificationRashi.valid).toBe(false);
    expect(verificationRashi.reason).toContain("Do not wrap וגו', וכו'");
  });

  test("accepts וגו' and וכו' and numerals untouched without <abbr> tags", () => {
    const sourceWithTruncation = "שנאמר ופתח אהל מועד תשבו יומם ולילה ז' ימים וגו' וכו'";
    const proposedWithTruncation = '<strong class="dibur-hamatchil">שנאמר</strong> - '
      + "ופתח אהל מועד תשבו יומם ולילה ז' ימים וגו' וכו':";
    const verification = verifyProposedHebrewWording(
      sourceWithTruncation, proposedWithTruncation);
    expect(verification.valid).toBe(true);
  });

  test("rejects bracketed explanations [...] that add Hebrew letters outside of explanation span", () => {
    const proposedHebrew = 'מתני\' כ"א תקיעות [הגמרא] מפרש להו בפ\' החליל:';
    const verification = verifyProposedHebrewWording(sourceHebrew, proposedHebrew);
    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain(
      "Proposed Hebrew modified the source text outside of <span class=\"explanation\">");
  });

  test("rejects when space between words is dropped", () => {
    const proposedHebrew = '<strong class="dibur-hamatchil">מתני\'</strong> - כ"אתקיעות, מפרש להו בפ\' החליל:';
    const verification = verifyProposedHebrewWording(sourceHebrew, proposedHebrew);
    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain(
      "Proposed Hebrew modified the source text outside of <span class=\"explanation\">");
  });

  test("rejects when an extra space is inserted within a word", () => {
    const proposedHebrew = '<strong class="dibur-hamatchil">מתני\'</strong> - כ"א תקי עות, מפרש להו בפ\' החליל:';
    const verification = verifyProposedHebrewWording(sourceHebrew, proposedHebrew);
    expect(verification.valid).toBe(false);
    expect(verification.reason).toContain(
      "Proposed Hebrew modified the source text outside of <span class=\"explanation\">");
  });
});

describe("extractHebrewWordsForVerification", () => {
  test("strips HTML tags and explanations while preserving space-delimited Hebrew words", () => {
    const markup = '<strong class="dibur-hamatchil"><abbr title="מתניתין">מתני\'</abbr></strong> - '
      + 'כ"א תקיעות, <span class="explanation">הגמרא</span> מפרש להו <abbr title="בפרק">בפ\'</abbr> החליל:';
    expect(extractHebrewWordsForVerification(markup)).toBe("מתני כא תקיעות מפרש להו בפ החליל");
  });
});

function fakeGenerationDeps(overrides: Partial<TranslationDeps> = {}): TranslationDeps {
  return {
    listCandidates: () => [],
    isFresh: () => false,
    generate: async () => generated(),
    writeEdit: () => {},
    recordGeneration: () => {},
    ...overrides,
  };
}

describe("translateRashiTosafotComments", () => {
  test("does nothing when there are no candidates", async () => {
    const writeEdit = jest.fn();
    await translateRashiTosafotComments(fakeGenerationDeps({listCandidates: () => [], writeEdit}));
    expect(writeEdit).not.toHaveBeenCalled();
  });

  test("skips a fresh candidate", async () => {
    const generate = jest.fn();
    await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [candidate()],
      isFresh: () => true,
      generate,
    }));
    expect(generate).not.toHaveBeenCalled();
  });

  test("writes and records a generated edit for a non-fresh candidate", async () => {
    const writeEdit = jest.fn();
    const recordGeneration = jest.fn();
    const gen = generated();
    await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [candidate()],
      isFresh: () => false,
      generate: async () => gen,
      writeEdit,
      recordGeneration,
    }));
    expect(writeEdit).toHaveBeenCalledWith(candidate(), {...gen.edit, status: "pending"});
    expect(recordGeneration).toHaveBeenCalledWith(candidate(), gen);
  });

  test("skips writing when generate gives up (returns undefined)", async () => {
    const writeEdit = jest.fn();
    const recordGeneration = jest.fn();
    await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [candidate()],
      generate: async () => undefined,
      writeEdit,
      recordGeneration,
    }));
    expect(writeEdit).not.toHaveBeenCalled();
    expect(recordGeneration).not.toHaveBeenCalled();
  });

  test("stops the whole run when generate hits a rate limit, without writing", async () => {
    const writeEdit = jest.fn();
    const generate = jest.fn()
      .mockRejectedValueOnce(new AgentError("You've hit your session limit", 429, "claude"));
    await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [candidate({ref: "a"}), candidate({ref: "b"})],
      generate,
      writeEdit,
    }));
    expect(generate).toHaveBeenCalledTimes(1); // never reached candidate "b"
    expect(writeEdit).not.toHaveBeenCalled();
  });

  test("skips a candidate on a non-rate-limit error and continues to the next", async () => {
    const written: string[] = [];
    await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [candidate({ref: "a"}), candidate({ref: "b"})],
      generate: async (c) => {
        if (c.ref === "a") throw new Error("transient CLI failure");
        return generated();
      },
      writeEdit: (c) => written.push(c.ref),
    }));
    expect(written).toEqual(["b"]);
  });

  test("processes multiple candidates independently", async () => {
    const written: string[] = [];
    const result = await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [
        candidate({ref: "a"}),
        candidate({ref: "b"}),
        candidate({ref: "c"}),
      ],
      isFresh: (c) => c.ref === "b",
      generate: async () => generated(),
      writeEdit: (c) => written.push(c.ref),
    }));
    expect(written).toEqual(["a", "c"]);
    expect(result).toEqual({rateLimited: false, candidatesProcessed: 2});
  });

  test("returns rateLimited: true and the error when rate limit is encountered", async () => {
    const rateLimitErr = new AgentError("Resource exhausted", 429, "claude");
    const result = await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [candidate({ref: "a"})],
      generate: async () => { throw rateLimitErr; },
    }));
    expect(result).toEqual({
      rateLimited: true,
      rateLimitError: rateLimitErr,
      candidatesProcessed: 0,
    });
  });

  test("stops early when shouldStop returns true", async () => {
    const written: string[] = [];
    let count = 0;
    const result = await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [candidate({ref: "a"}), candidate({ref: "b"})],
      generate: async () => {
        count++;
        return generated();
      },
      writeEdit: (c) => written.push(c.ref),
      shouldStop: () => count >= 1,
    }));
    expect(written).toEqual(["a"]);
    expect(result).toEqual({
      rateLimited: false,
      candidatesProcessed: 1,
      stoppedDueToDeadline: true,
    });
  });

  test("stops early and flags stoppedDueToSignal when generate throws cancelled error", async () => {
    const cancelledErr = new AgentError("Process cancelled", undefined, "claude", true);
    const writeEdit = jest.fn();
    const result = await translateRashiTosafotComments(fakeGenerationDeps({
      listCandidates: () => [candidate({ref: "a"}), candidate({ref: "b"})],
      generate: async () => { throw cancelledErr; },
      writeEdit,
    }));
    expect(writeEdit).not.toHaveBeenCalled();
    expect(result).toEqual({
      rateLimited: false,
      candidatesProcessed: 0,
      stoppedDueToDeadline: true,
      stoppedDueToSignal: true,
    });
  });
});

describe("runContinuousTranslation", () => {
  test("processes all candidates and stops with all_completed", async () => {
    const freshSet = new Set<string>();
    const written: string[] = [];
    const candidates = [candidate({ref: "a"}), candidate({ref: "b"})];
    let currentTime = 1000;

    const summary = await runContinuousTranslation({
      listCandidates: () => candidates,
      isFresh: c => freshSet.has(c.ref),
      generate: async () => generated(),
      writeEdit: (c) => {
        written.push(c.ref);
        freshSet.add(c.ref);
      },
      recordGeneration: () => {},
      durationMs: 24 * 60 * 60 * 1000,
      now: () => currentTime,
      sleep: async (ms) => { currentTime += ms; },
      logger: {log: () => {}, error: () => {}},
    });

    expect(written).toEqual(["a", "b"]);
    expect(summary).toEqual({
      totalProcessed: 2,
      totalPauses: 0,
      stoppedReason: "all_completed",
    });
  });

  test("exits immediately with all_completed if all candidates are already fresh", async () => {
    const onProgress = jest.fn();
    const summary = await runContinuousTranslation({
      listCandidates: () => [candidate({ref: "a"})],
      isFresh: () => true,
      generate: async () => generated(),
      writeEdit: () => {},
      recordGeneration: () => {},
      onProgress,
      durationMs: 24 * 60 * 60 * 1000,
      now: () => 1000,
      sleep: async () => {},
      logger: {log: () => {}, error: () => {}},
    });

    expect(summary).toEqual({
      totalProcessed: 0,
      totalPauses: 0,
      stoppedReason: "all_completed",
    });
    expect(onProgress).toHaveBeenCalledTimes(1);
  });

  test("stops with duration_elapsed when time limit is reached during execution", async () => {
    const freshSet = new Set<string>();
    const candidates = [candidate({ref: "a"}), candidate({ref: "b"}), candidate({ref: "c"})];
    let currentTime = 0;
    const durationMs = 1000;

    const summary = await runContinuousTranslation({
      listCandidates: () => candidates,
      isFresh: c => freshSet.has(c.ref),
      generate: async () => {
        currentTime += 1500; // First candidate takes 1500ms, pushing next past durationMs (1000ms)
        return generated();
      },
      writeEdit: c => freshSet.add(c.ref),
      recordGeneration: () => {},
      durationMs,
      now: () => currentTime,
      sleep: async (ms) => { currentTime += ms; },
      logger: {log: () => {}, error: () => {}},
    });

    expect(summary).toEqual({
      totalProcessed: 1,
      totalPauses: 0,
      stoppedReason: "duration_elapsed",
    });
  });

  test("pauses hourly when quota exhausted, then resumes when available", async () => {
    const freshSet = new Set<string>();
    const candidates = [candidate({ref: "a"}), candidate({ref: "b"})];
    let currentTime = 0;
    const checkIntervalMs = 60 * 60 * 1000; // 1 hour
    const sleepCalls: number[] = [];
    const logs: string[] = [];
    const onProgress = jest.fn();

    let quotaAvailable = false;
    let generateAttempts = 0;

    const summary = await runContinuousTranslation({
      listCandidates: () => candidates,
      isFresh: c => freshSet.has(c.ref),
      generate: async (c) => {
        generateAttempts++;
        if (c.ref === "b" && !quotaAvailable) {
          throw new AgentError("Rate limit exceeded", 429, "claude");
        }
        return generated();
      },
      writeEdit: (c) => freshSet.add(c.ref),
      recordGeneration: () => {},
      onProgress,
      durationMs: 24 * 60 * 60 * 1000,
      checkIntervalMs,
      now: () => currentTime,
      sleep: async (ms) => {
        sleepCalls.push(ms);
        currentTime += ms;
        // On waking after the 1st hourly sleep, quota has recovered!
        quotaAvailable = true;
      },
      logger: {
        log: (msg: string) => logs.push(msg),
        error: () => {},
      },
    });

    expect(summary).toEqual({
      totalProcessed: 2,
      totalPauses: 1,
      stoppedReason: "all_completed",
    });
    // Slept for 1 hour (3600000 ms)
    expect(sleepCalls).toEqual([3600000]);
    // Progress was committed after candidate "a", then on rate limit, then after candidate "b"
    expect(onProgress).toHaveBeenCalled();
    // Candidate "b" was attempted twice (once hit rate limit, once succeeded)
    expect(generateAttempts).toBe(3); // "a", "b" (failed), "b" (succeeded)
    expect(freshSet.has("a")).toBe(true);
    expect(freshSet.has("b")).toBe(true);
  });

  test("pauses multiple hourly checks if quota remains exhausted", async () => {
    const freshSet = new Set<string>();
    const candidates = [candidate({ref: "a"})];
    let currentTime = 0;
    const checkIntervalMs = 60 * 60 * 1000;
    const sleepCalls: number[] = [];

    let attempts = 0;

    const summary = await runContinuousTranslation({
      listCandidates: () => candidates,
      isFresh: c => freshSet.has(c.ref),
      generate: async () => {
        attempts++;
        if (attempts < 3) {
          throw new AgentError("quota exceeded", 429, "agy");
        }
        return generated();
      },
      writeEdit: c => freshSet.add(c.ref),
      recordGeneration: () => {},
      durationMs: 24 * 60 * 60 * 1000,
      checkIntervalMs,
      now: () => currentTime,
      sleep: async (ms) => {
        sleepCalls.push(ms);
        currentTime += ms;
      },
      logger: {log: () => {}, error: () => {}},
    });

    expect(summary).toEqual({
      totalProcessed: 1,
      totalPauses: 2,
      stoppedReason: "all_completed",
    });
    expect(sleepCalls).toEqual([3600000, 3600000]);
    expect(attempts).toBe(3);
    expect(freshSet.has("a")).toBe(true);
  });

  test("stops with duration_elapsed when duration expires while paused for quota", async () => {
    let currentTime = 0;
    const durationMs = 2 * 60 * 60 * 1000; // 2 hours
    const checkIntervalMs = 60 * 60 * 1000; // 1 hour
    const sleepCalls: number[] = [];

    const summary = await runContinuousTranslation({
      listCandidates: () => [candidate({ref: "a"})],
      isFresh: () => false,
      generate: async () => {
        throw new AgentError("quota exceeded", 429, "claude");
      },
      writeEdit: () => {},
      recordGeneration: () => {},
      durationMs,
      checkIntervalMs,
      now: () => currentTime,
      sleep: async (ms) => {
        sleepCalls.push(ms);
        currentTime += ms;
      },
      logger: {log: () => {}, error: () => {}},
    });

    expect(summary).toEqual({
      totalProcessed: 0,
      totalPauses: 2,
      stoppedReason: "duration_elapsed",
    });
    // Two 1-hour pauses hit the 2-hour duration limit
    expect(sleepCalls).toEqual([3600000, 3600000]);
  });

  test("stops with stopped_by_signal when shouldStop returns true", async () => {
    let stop = false;
    let candidatesProcessed = 0;
    const summary = await runContinuousTranslation({
      listCandidates: () => [candidate({ref: "a"}), candidate({ref: "b"})],
      isFresh: () => false,
      generate: async () => {
        candidatesProcessed++;
        stop = true;
        return generated();
      },
      writeEdit: () => {},
      recordGeneration: () => {},
      durationMs: 24 * 60 * 60 * 1000,
      shouldStop: () => stop,
      logger: {log: () => {}, error: () => {}},
    });

    expect(candidatesProcessed).toBe(1);
    expect(summary).toEqual({
      totalProcessed: 1,
      totalPauses: 0,
      stoppedReason: "stopped_by_signal",
    });
  });

  test("stops with stopped_by_signal and wakes from sleep when aborted", async () => {
    const controller = new AbortController();
    let slept = false;

    const summary = await runContinuousTranslation({
      listCandidates: () => [candidate({ref: "a"})],
      isFresh: () => false,
      generate: async () => {
        throw new AgentError("quota exceeded", 429, "claude");
      },
      writeEdit: () => {},
      recordGeneration: () => {},
      durationMs: 24 * 60 * 60 * 1000,
      checkIntervalMs: 60 * 60 * 1000,
      signal: controller.signal,
      sleep: async () => {
        slept = true;
        controller.abort();
      },
      logger: {log: () => {}, error: () => {}},
    });

    expect(slept).toBe(true);
    expect(summary).toEqual({
      totalProcessed: 0,
      totalPauses: 1,
      stoppedReason: "stopped_by_signal",
    });
  });

  test("default sleep wakes up when aborted", async () => {
    const controller = new AbortController();
    setTimeout(() => { controller.abort(); }, 15);

    const startTime = Date.now();
    const summary = await runContinuousTranslation({
      listCandidates: () => [candidate({ref: "a"})],
      isFresh: () => false,
      generate: async () => {
        throw new AgentError("quota exceeded", 429, "claude");
      },
      writeEdit: () => {},
      recordGeneration: () => {},
      durationMs: 24 * 60 * 60 * 1000,
      checkIntervalMs: 60 * 60 * 1000,
      signal: controller.signal,
      logger: {log: () => {}, error: () => {}},
    });

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(2000); // Definitely didn't wait 1 hour!
    expect(summary.stoppedReason).toBe("stopped_by_signal");
  });
});

describe("filterSectionsFromStartPage", () => {
  const sections = ["2a", "2b", "3a", "3b", "10a", "10b", "11a"];

  test("filters from exact matching section", () => {
    expect(filterSectionsFromStartPage(sections, "10b")).toEqual(["10b", "11a"]);
  });

  test("normalizes integer page to daf 'a'", () => {
    expect(filterSectionsFromStartPage(sections, "10")).toEqual(["10a", "10b", "11a"]);
  });

  test("finds closest subsequent page when exact page not in list", () => {
    expect(filterSectionsFromStartPage(sections, "4a")).toEqual(["10a", "10b", "11a"]);
  });

  test("returns all sections when start page is before first section", () => {
    expect(filterSectionsFromStartPage(sections, "1a")).toEqual(sections);
  });

  test("returns empty array when start page is after all sections", () => {
    expect(filterSectionsFromStartPage(sections, "20a")).toEqual([]);
  });
});

describe("compareAmudim", () => {
  test("compares dafim numerically", () => {
    expect(compareAmudim("2b", "10a")).toBeLessThan(0);
    expect(compareAmudim("10a", "2b")).toBeGreaterThan(0);
  });

  test("compares amud 'a' and 'b' on same daf", () => {
    expect(compareAmudim("10a", "10b")).toBeLessThan(0);
    expect(compareAmudim("10b", "10a")).toBeGreaterThan(0);
    expect(compareAmudim("10a", "10a")).toBe(0);
  });
});

describe("parseJsonResponse", () => {
  test("parses plain JSON", () => {
    expect(parseJsonResponse<{a: number}>('{"a": 1}')).toEqual({a: 1});
  });

  test("strips a surrounding markdown code fence", () => {
    expect(parseJsonResponse<{a: number}>('```json\n{"a": 1}\n```')).toEqual({a: 1});
  });

  test("strips a code fence with no language tag", () => {
    expect(parseJsonResponse<{a: number}>('```\n{"a": 1}\n```')).toEqual({a: 1});
  });

  test("extracts JSON when surrounded by text", () => {
    expect(parseJsonResponse<{valid: boolean}>('Decision:\n{"valid": true}\nDone.')).toEqual({
      valid: true,
    });
  });
});

describe("critiquePrompt", () => {
  test("instructs terse output and compact JSON format", () => {
    const prompt = critiquePrompt(candidate(), {hebrew: "מקור:", english: "source."});
    expect(prompt).toContain("Be extremely terse to minimize token usage.");
    expect(prompt).toContain('{"valid": true}');
    expect(prompt).toContain('{"valid": false, "reason": "<brief one-sentence reason>"}');
    expect(prompt).toContain("Keep any rejection reason to a single brief sentence.");
  });

  test("places static rules and format requirements before dynamic candidate content for prefix caching", () => {
    const prompt = critiquePrompt(candidate(), {hebrew: "מקור:", english: "source."});
    const rulesIndex = prompt.indexOf("Be extremely terse to minimize token usage.");
    const targetIndex = prompt.indexOf("## Target comment to check");
    expect(rulesIndex).toBeGreaterThan(-1);
    expect(targetIndex).toBeGreaterThan(-1);
    expect(rulesIndex).toBeLessThan(targetIndex);
  });
});

describe("targetComment", () => {
  test("lists the commentary nested on the comment, e.g. Otzar La'azei Rashi", () => {
    const refsSpy = jest.spyOn(contextFetch, "getCommentRefs").mockReturnValue({commentary: {
      "Otzar Laazei Rashi": ["Otzar La'azei Rashi, Talmud, Bava Kamma 14"],
      Verses: ["Exodus 21:35"],
    }});
    try {
      const text = targetComment(candidate(), "מקור", undefined);
      expect(text).toContain("Commentary on this comment: Otzar Laazei Rashi: "
        + "Otzar La'azei Rashi, Talmud, Bava Kamma 14; Verses: Exodus 21:35");
    } finally {
      refsSpy.mockRestore();
    }
  });

  test("omits the line when nothing is nested on the comment", () => {
    const refsSpy = jest.spyOn(contextFetch, "getCommentRefs").mockReturnValue({commentary: {}});
    try {
      expect(targetComment(candidate(), "מקור", undefined)).not.toContain("Commentary on this comment");
    } finally {
      refsSpy.mockRestore();
    }
  });
});

describe("generationPrompt", () => {
  test("places static tasks, rules, and skeleton before dynamic candidate commentary text for prefix caching", () => {
    const buildPageSkeletonSpy = jest.spyOn(pageSkeleton, "buildPageSkeleton").mockReturnValue({
      page: "Menachot 80a",
      segments: [
        {
          ref: "Menachot 80a:1",
          commentary: {Rashi: 1},
        },
      ],
    });
    try {
      const testCandidate = candidate({
        book: "Menachot",
        section: "80a",
        page: "Menachot 80a",
        ref: "Rashi on Menachot 80a:1:1",
        commentator: "Rashi",
        hebrewSource: "מקור הבדיקה",
      });
      const prompt = generationPrompt(testCandidate, "previous error message");
      const tasksIndex = prompt.indexOf("## Tasks");
      const rulesIndex = prompt.indexOf("## Rules on tools and external lookups");
      const skeletonIndex = prompt.indexOf("Page index (segment refs");
      const targetIndex = prompt.indexOf("## Target commentary comment to translate");
      const feedbackIndex = prompt.indexOf("Your previous attempt was rejected for this reason");

      expect(tasksIndex).toBeGreaterThan(-1);
      expect(rulesIndex).toBeGreaterThan(tasksIndex);
      expect(skeletonIndex).toBeGreaterThan(rulesIndex);
      expect(targetIndex).toBeGreaterThan(skeletonIndex);
      expect(feedbackIndex).toBeGreaterThan(targetIndex);
    } finally {
      buildPageSkeletonSpy.mockRestore();
    }
  });
});

describe("generateViaAgent and critiqueViaAgent backend validation", () => {
  test("generateViaAgent throws when no backend is configured", async () => {
    const getTaskModelConfigSpy = jest.spyOn(modelRouting, "getTaskModelConfig").mockReturnValue({
      backend: undefined as any,
      generateModel: "model",
      critiqueModel: "model",
    });
    try {
      await expect(generateViaAgent(candidate())).rejects.toThrow(
        "No backend configured for generation",
      );
    } finally {
      getTaskModelConfigSpy.mockRestore();
    }
  });

  test("critiqueViaAgent throws when no backend is configured", async () => {
    const getTaskModelConfigSpy = jest.spyOn(modelRouting, "getTaskModelConfig").mockReturnValue({
      backend: undefined as any,
      generateModel: "model",
      critiqueModel: "model",
    });
    try {
      await expect(critiqueViaAgent(candidate(), {hebrew: "מקור"})).rejects.toThrow(
        "No backend configured for critique",
      );
    } finally {
      getTaskModelConfigSpy.mockRestore();
    }
  });
});

describe("base64 image decoding, placeholders, and restoration", () => {
  const sampleBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhg"
    + "GAWjR9awAAAABJRU5ErkJggg==";
  const sampleDataUri = `data:image/png;base64,${sampleBase64}`;

  test("generationPrompt replaces base64 data URI with IMAGE_PLACEHOLDER_1 and adds instruction", () => {
    const buildPageSkeletonSpy = jest.spyOn(pageSkeleton, "buildPageSkeleton").mockReturnValue({
      page: "Menachot 98a",
      segments: [
        {
          ref: "Menachot 98a:1",
          commentary: {Rashi: 1},
        },
      ],
    });
    try {
      const imageCandidate = candidate({
        book: "Menachot",
        section: "98a",
        page: "Menachot 98a",
        ref: "Rashi on Menachot 98a:1:1",
        commentator: "Rashi",
        hebrewSource: `הגה"ה <img src="${sampleDataUri}"> ע"כ`,
      });
      const prompt = generationPrompt(imageCandidate);
      expect(prompt).not.toContain(sampleBase64);
      expect(prompt).toContain('Current Hebrew text: הגה"ה <img src="IMAGE_PLACEHOLDER_1"> ע"כ');
      expect(prompt).toContain("Note: Base64-encoded images in the source text have been decoded");
    } finally {
      buildPageSkeletonSpy.mockRestore();
    }
  });

  test("critiquePrompt replaces base64 data URIs with consistent placeholders across original and proposed fields", () => {
    const imageCandidate = candidate({
      hebrewSource: `הגה"ה <img src="${sampleDataUri}"> ע"כ`,
    });
    const proposedEdit: Edit = {
      hebrew: `<strong class="dibur-hamatchil">הגה"ה</strong> - <img src="${sampleDataUri}"> ע"כ:`,
      english: `<strong class="dibur-hamatchil">Gloss:</strong> <img src="${sampleDataUri}">.`,
    };
    const prompt = critiquePrompt(imageCandidate, proposedEdit);
    expect(prompt).not.toContain(sampleBase64);
    expect(prompt).toContain('Original Hebrew: הגה"ה <img src="IMAGE_PLACEHOLDER_1"> ע"כ');
    expect(prompt).toContain(
      'Proposed Hebrew: <strong class="dibur-hamatchil">הגה"ה</strong> - <img src="IMAGE_PLACEHOLDER_1"> ע"כ:',
    );
    expect(prompt).toContain(
      'Proposed English: <strong class="dibur-hamatchil">Gloss:</strong> <img src="IMAGE_PLACEHOLDER_1">.',
    );
    expect(prompt).toContain("Treat matching placeholders as preserving the original image.");
  });

  test("generateWithSelfCritique restores IMAGE_PLACEHOLDER_1 to original data URI in final edit", async () => {
    const imageCandidate = candidate({
      hebrewSource: `הגה"ה <img src="${sampleDataUri}"> ע"כ`,
    });
    const generate = jest.fn(async () => generated({
      edit: {
        hebrew: '<b>הגה"ה</b> - <img src="IMAGE_PLACEHOLDER_1"> ע"כ:',
        english: '<b>Gloss:</b> <img src="IMAGE_PLACEHOLDER_1">.',
      },
    }));
    const critique = jest.fn(async () => validOutcome);

    const result = await generateWithSelfCritique(imageCandidate, {generate, critique});
    expect(result).toBeDefined();
    expect(result!.edit).toEqual({
      hebrew: `<b>הגה"ה</b> - <img src="${sampleDataUri}"> ע"כ:`,
      english: `<b>Gloss:</b> <img src="${sampleDataUri}">.`,
    });
  });

  test("generateViaAgent and critiqueViaAgent pass decoded images to runner and restore placeholders", async () => {
    const buildPageSkeletonSpy = jest.spyOn(pageSkeleton, "buildPageSkeleton").mockReturnValue({
      page: "Menachot 98a",
      segments: [{ref: "Menachot 98a:1", commentary: {Rashi: 1}}],
    });
    const recordContextUsageSpy = jest
      .spyOn(contextUsageLog, "recordContextUsage")
      .mockImplementation(() => {});
    const mockRunner = jest.fn()
      .mockResolvedValueOnce({
        text: JSON.stringify({
          hebrew: '<b>הגה"ה</b> - <img src="IMAGE_PLACEHOLDER_1"> ע"כ:',
          english: '<b>Gloss:</b> <img src="IMAGE_PLACEHOLDER_1">.',
        }),
        model: "claude-sonnet-5",
        costUsd: 0.01,
        toolUses: [],
      })
      .mockResolvedValueOnce({
        text: JSON.stringify({valid: true}),
        model: "claude-sonnet-5",
        costUsd: 0.002,
        toolUses: [],
      });
    const getAgentRunnerSpy = jest.spyOn(agentRunner, "getAgentRunner").mockReturnValue(mockRunner);

    try {
      const imageCandidate = candidate({
        book: "Menachot",
        section: "98a",
        page: "Menachot 98a",
        ref: "Rashi on Menachot 98a:1:1",
        commentator: "Rashi",
        hebrewSource: `הגה"ה <img src="${sampleDataUri}"> ע"כ`,
      });

      const generatedResult = await generateViaAgent(imageCandidate, undefined, {backend: "claude"});
      expect(mockRunner).toHaveBeenCalledTimes(1);
      const [generatePromptText, generateAgentOptions] = mockRunner.mock.calls[0];
      expect(generatePromptText).not.toContain(sampleBase64);
      expect(generatePromptText).toContain("IMAGE_PLACEHOLDER_1");
      expect(generateAgentOptions.images).toHaveLength(1);
      expect(generateAgentOptions.images[0].placeholder).toBe("IMAGE_PLACEHOLDER_1");
      expect(generateAgentOptions.images[0].base64Data).toBe(sampleBase64);

      expect(generatedResult.edit).toEqual({
        hebrew: `<b>הגה"ה</b> - <img src="${sampleDataUri}"> ע"כ:`,
        english: `<b>Gloss:</b> <img src="${sampleDataUri}">.`,
      });

      const critiqueResult = await critiqueViaAgent(
        imageCandidate,
        generatedResult.edit,
        {backend: "claude"},
      );
      expect(critiqueResult.verdict.valid).toBe(true);
      expect(mockRunner).toHaveBeenCalledTimes(2);
      const [critiquePromptText, critiqueAgentOptions] = mockRunner.mock.calls[1];
      expect(critiquePromptText).not.toContain(sampleBase64);
      expect(critiquePromptText).toContain("IMAGE_PLACEHOLDER_1");
      expect(critiqueAgentOptions.images).toHaveLength(1);
      expect(critiqueAgentOptions.images[0].placeholder).toBe("IMAGE_PLACEHOLDER_1");
    } finally {
      buildPageSkeletonSpy.mockRestore();
      recordContextUsageSpy.mockRestore();
      getAgentRunnerSpy.mockRestore();
    }
  });

  describe("isFreshTranslation and task records", () => {
    test("TASK_TYPE is rashi_tosafot_translation", () => {
      expect(TASK_TYPE).toBe("rashi_tosafot_translation");
    });

    test("recognizes freshness from generation record", () => {
      const readSpy = jest.spyOn(generationRecordModule, "readGenerationRecord")
        .mockImplementation((taskType: string) => {
          if (taskType === TASK_TYPE) {
            return {
              sourceRefs: ["Rashi on Zevachim 2a:1:1"],
              sourceText: "מקור",
              model: "claude-sonnet-5",
              promptVersion: "v2",
              generatedAt: "2026-10-22T00:00:00.000Z",
              dependsOn: [],
            };
          }
          return undefined;
        });

      try {
        const testCandidate = candidate({hebrewSource: "מקור"});
        expect(isFreshTranslation(testCandidate)).toBe(true);
      } finally {
        readSpy.mockRestore();
      }
    });

    test("recordGenerationForCandidate records promptVersion v3 under TASK_TYPE", () => {
      const upsertSpy = jest.spyOn(generationRecordModule, "upsertGenerationRecord")
        .mockImplementation(() => {});

      try {
        const testCandidate = candidate({hebrewSource: "מקור"});
        const generatedEdit: GeneratedEdit = {
          edit: {hebrew: "מקור.", english: "source"},
          model: "claude-sonnet-5",
          costUsd: 0.015,
          contextRefsUsed: ["Zevachim 2a:1"],
        };
        recordGenerationForCandidate(testCandidate, generatedEdit);

        expect(upsertSpy).toHaveBeenCalledTimes(1);
        const [taskType, page, ref, record] = upsertSpy.mock.calls[0];
        expect(taskType).toBe("rashi_tosafot_translation");
        expect(page).toBe(testCandidate.page);
        expect(ref).toBe(testCandidate.ref);
        expect(record.promptVersion).toBe("v3");
      } finally {
        upsertSpy.mockRestore();
      }
    });
  });
});
