import {
  continuationCritiquePrompt,
  continuationGenerationPrompt,
  getBaseBackend,
  isLongThreadBackend,
  LongThreadSessionManager,
} from "./long_thread_session";
import {CritiqueOutcome, TranslationCandidate} from "./rashi_tosafot_translation";

function makeCandidate(overrides: Partial<TranslationCandidate> = {}): TranslationCandidate {
  return {
    page: "Menachot 80a",
    book: "Menachot",
    section: "80a",
    ref: "Rashi on Menachot 80a:1:1",
    commentator: "Rashi",
    hebrewSource: "טקסט עברי ראשון",
    ...overrides,
  };
}

function makeCritiqueOutcome(valid: boolean, reason?: string): CritiqueOutcome {
  return {
    verdict: {valid, reason},
    costUsd: 0.005,
    contextRefsUsed: [],
  };
}

describe("long_thread_session backend helpers", () => {
  test("identifies long-thread backends correctly", () => {
    expect(isLongThreadBackend("claude-long-thread")).toBe(true);
    expect(isLongThreadBackend("agy-long-thread")).toBe(true);
    expect(isLongThreadBackend("claude")).toBe(false);
    expect(isLongThreadBackend("agy")).toBe(false);
    expect(isLongThreadBackend(undefined)).toBe(false);
  });

  test("resolves base backend for CLI execution", () => {
    expect(getBaseBackend("claude-long-thread")).toBe("claude");
    expect(getBaseBackend("agy-long-thread")).toBe("agy");
    expect(getBaseBackend("claude")).toBe("claude");
    expect(getBaseBackend("agy")).toBe("agy");
  });
});

describe("continuation prompts", () => {
  test("formats concise continuation generation prompt", () => {
    const candidate = makeCandidate();
    const prompt = continuationGenerationPrompt(candidate);
    expect(prompt).toContain("Next commentary comment to translate and punctuate on this page:");
    expect(prompt).toContain("Comment ref: Rashi on Menachot 80a:1:1");
    expect(prompt).toContain("Follow the same tasks and formatting rules as established above.");
  });

  test("formats concise continuation critique prompt", () => {
    const candidate = makeCandidate();
    const prompt = continuationCritiquePrompt(candidate, {
      hebrew: "טקסט:",
      english: "translated text.",
    });
    expect(prompt).toContain("Target comment to check:");
    expect(prompt).toContain("Comment ref: Rashi on Menachot 80a:1:1");
    expect(prompt).toContain("Apply the same verification criteria and rules as established above.");
  });
});

describe("LongThreadSessionManager", () => {
  test("starts fresh and creates initial sessions for claude", () => {
    const sessionManager = new LongThreadSessionManager();
    const candidateOne = makeCandidate({ref: "Rashi on Menachot 80a:1:1"});

    expect(sessionManager.shouldContinue(candidateOne)).toBe(false);

    const generateInfo = sessionManager.prepareGenerateSession(candidateOne, "claude-long-thread", false);
    expect(generateInfo.isResume).toBe(false);
    expect(generateInfo.sessionId).toBeDefined();

    sessionManager.recordGenerateResult(generateInfo.sessionId, 1200);

    const critiqueInfo = sessionManager.prepareCritiqueSession("claude-long-thread");
    expect(critiqueInfo.isResume).toBe(false);
    expect(critiqueInfo.sessionId).toBeDefined();

    sessionManager.recordCritiqueOutcome(makeCritiqueOutcome(true), critiqueInfo.sessionId, 400);

    expect(sessionManager.turnCount).toBe(1);
    expect(sessionManager.accumulatedTokens).toBe(1600);

    // Next candidate on the same page should resume sessions
    const candidateTwo = makeCandidate({ref: "Rashi on Menachot 80a:1:2"});
    expect(sessionManager.shouldContinue(candidateTwo)).toBe(true);

    const nextGenerateInfo = sessionManager.prepareGenerateSession(candidateTwo, "claude-long-thread", false);
    expect(nextGenerateInfo.isResume).toBe(true);
    expect(nextGenerateInfo.sessionId).toBe(generateInfo.sessionId);

    const nextCritiqueInfo = sessionManager.prepareCritiqueSession("claude-long-thread");
    expect(nextCritiqueInfo.isResume).toBe(true);
    expect(nextCritiqueInfo.sessionId).toBe(critiqueInfo.sessionId);
  });

  test("tosses both threads when critique is negative", () => {
    const sessionManager = new LongThreadSessionManager();
    const candidateOne = makeCandidate();

    const generateInfo = sessionManager.prepareGenerateSession(candidateOne, "claude-long-thread", false);
    sessionManager.recordGenerateResult(generateInfo.sessionId, 1000);

    const critiqueInfo = sessionManager.prepareCritiqueSession("claude-long-thread");
    // Negative critique!
    sessionManager.recordCritiqueOutcome(
      makeCritiqueOutcome(false, "Changed source words"),
      critiqueInfo.sessionId,
      500,
    );

    // Both threads should be discarded
    expect(sessionManager.generateSessionId).toBeUndefined();
    expect(sessionManager.critiqueSessionId).toBeUndefined();
    expect(sessionManager.shouldContinue(candidateOne)).toBe(false);

    // Next attempt starts fresh
    const retryGenerateInfo = sessionManager.prepareGenerateSession(candidateOne, "claude-long-thread", true);
    expect(retryGenerateInfo.isResume).toBe(false);
    expect(retryGenerateInfo.sessionId).not.toBe(generateInfo.sessionId);
  });

  test("tosses threads when page boundary changes", () => {
    const sessionManager = new LongThreadSessionManager();
    const candidateOnPageA = makeCandidate({page: "Menachot 80a"});

    const generateInfo = sessionManager.prepareGenerateSession(candidateOnPageA, "claude-long-thread", false);
    sessionManager.recordGenerateResult(generateInfo.sessionId, 500);

    const critiqueInfo = sessionManager.prepareCritiqueSession("claude-long-thread");
    sessionManager.recordCritiqueOutcome(makeCritiqueOutcome(true), critiqueInfo.sessionId, 200);

    const candidateOnPageB = makeCandidate({page: "Menachot 80b"});
    expect(sessionManager.shouldContinue(candidateOnPageB)).toBe(false);

    const newPageGenerateInfo = sessionManager.prepareGenerateSession(candidateOnPageB, "claude-long-thread", false);
    expect(newPageGenerateInfo.isResume).toBe(false);
    expect(sessionManager.currentPage).toBe("Menachot 80b");
  });

  test("resets sessions cleanly when maximum turns limit is reached", () => {
    const sessionManager = new LongThreadSessionManager({maximumTurns: 2});
    const candidate = makeCandidate();

    // Turn 1
    const generateTurnOne = sessionManager.prepareGenerateSession(candidate, "claude-long-thread", false);
    sessionManager.recordGenerateResult(generateTurnOne.sessionId, 100);
    const critiqueTurnOne = sessionManager.prepareCritiqueSession("claude-long-thread");
    sessionManager.recordCritiqueOutcome(makeCritiqueOutcome(true), critiqueTurnOne.sessionId, 100);

    expect(sessionManager.shouldContinue(candidate)).toBe(true);

    // Turn 2
    const generateTurnTwo = sessionManager.prepareGenerateSession(candidate, "claude-long-thread", false);
    sessionManager.recordGenerateResult(generateTurnTwo.sessionId, 100);
    const critiqueTurnTwo = sessionManager.prepareCritiqueSession("claude-long-thread");
    sessionManager.recordCritiqueOutcome(makeCritiqueOutcome(true), critiqueTurnTwo.sessionId, 100);

    // Reached maximum turns: manager automatically resets
    expect(sessionManager.generateSessionId).toBeUndefined();
    expect(sessionManager.critiqueSessionId).toBeUndefined();
    expect(sessionManager.shouldContinue(candidate)).toBe(false);
  });

  test("resets sessions cleanly when maximum tokens limit is reached", () => {
    const sessionManager = new LongThreadSessionManager({maximumTokens: 3000});
    const candidate = makeCandidate();

    const generateInfo = sessionManager.prepareGenerateSession(candidate, "claude-long-thread", false);
    sessionManager.recordGenerateResult(generateInfo.sessionId, 2000);

    const critiqueInfo = sessionManager.prepareCritiqueSession("claude-long-thread");
    sessionManager.recordCritiqueOutcome(makeCritiqueOutcome(true), critiqueInfo.sessionId, 1500);

    // Accumulated 3500 tokens >= 3000 maximum: manager automatically resets
    expect(sessionManager.generateSessionId).toBeUndefined();
    expect(sessionManager.critiqueSessionId).toBeUndefined();
    expect(sessionManager.shouldContinue(candidate)).toBe(false);
  });

  test("handles agy session capture from response", () => {
    const sessionManager = new LongThreadSessionManager();
    const candidate = makeCandidate();

    const generateInfo = sessionManager.prepareGenerateSession(candidate, "agy-long-thread", false);
    expect(generateInfo.sessionId).toBeUndefined();
    expect(generateInfo.isResume).toBe(false);

    // Agy produces conversation ID on stdout, which is recorded
    const agyConversationId = "agy-convo-12345";
    sessionManager.recordGenerateResult(agyConversationId, 800);
    expect(sessionManager.generateSessionId).toBe(agyConversationId);

    const critiqueInfo = sessionManager.prepareCritiqueSession("agy-long-thread");
    expect(critiqueInfo.sessionId).toBeUndefined();

    const agyCritiqueId = "agy-critique-67890";
    sessionManager.recordCritiqueOutcome(makeCritiqueOutcome(true), agyCritiqueId, 300);
    expect(sessionManager.critiqueSessionId).toBe(agyCritiqueId);

    // Next turn should resume both agy conversations
    expect(sessionManager.shouldContinue(candidate)).toBe(true);
    const nextGenerate = sessionManager.prepareGenerateSession(candidate, "agy-long-thread", false);
    expect(nextGenerate.isResume).toBe(true);
    expect(nextGenerate.sessionId).toBe(agyConversationId);
  });
});
