import {
  commitAndPushPendingCandidates,
  CommitPendingDeps,
  extractPagesFromPaths,
  FileEditStat,
  formatDiffStatsTable,
  formatPrTitle,
  makeRealCommitPendingDeps,
  mergeFileContent,
  parseDiffStats,
  parseStatusPaths,
  realCommitPendingDeps,
} from "./commit_pending";

describe("parseStatusPaths", () => {
  test("parses plain paths with no special characters", () => {
    expect(parseStatusPaths(" M precomputed/ai_additions/Zevachim.json")).toEqual(
      ["precomputed/ai_additions/Zevachim.json"]);
  });

  // git quotes any path containing a space (verified against a real repo) — every ai_additions
  // path does, since pages are named e.g. "Menachot 87a.json". Missing this parses the quotes
  // themselves as part of the path, which then fails to match any real file.
  test("un-quotes paths git quotes for containing a space", () => {
    expect(parseStatusPaths(' M "precomputed/ai_additions/Menachot 87a.json"')).toEqual(
      ["precomputed/ai_additions/Menachot 87a.json"]);
  });

  test("parses multiple lines, ignoring blank ones", () => {
    const statusOut = [
      ' M "precomputed/ai_additions/Menachot 87a.json"',
      '?? "precomputed/ai_additions/Menachot 87b.json"',
      "",
    ].join("\n");
    expect(parseStatusPaths(statusOut)).toEqual([
      "precomputed/ai_additions/Menachot 87a.json",
      "precomputed/ai_additions/Menachot 87b.json",
    ]);
  });
});

describe("mergeFileContent", () => {
  test("JSON files merge by key union, local winning on a duplicate ref", () => {
    const remote = JSON.stringify({"ref-a": {english: "remote a"}, "ref-b": {english: "b"}});
    const local = JSON.stringify({"ref-a": {english: "local a"}, "ref-c": {english: "c"}});

    const merged = JSON.parse(mergeFileContent("precomputed/ai_additions/Foo.json", remote, local));

    expect(merged).toEqual({
      "ref-a": {english: "local a"},
      "ref-b": {english: "b"},
      "ref-c": {english: "c"},
    });
  });

  test("JSON files with no remote content yet just take the local content", () => {
    const local = JSON.stringify({"ref-a": {english: "a"}});

    const merged = JSON.parse(
      mergeFileContent("precomputed/ai_additions/Foo.json", undefined, local));

    expect(merged).toEqual({"ref-a": {english: "a"}});
  });

  test("jsonl files merge by line union, keeping remote's lines first", () => {
    const remote = '{"ref":"a"}\n{"ref":"b"}\n';
    const local = '{"ref":"b"}\n{"ref":"c"}\n';

    const merged = mergeFileContent("precomputed/rsi_state/context_usage_log.jsonl", remote, local);

    expect(merged).toEqual('{"ref":"a"}\n{"ref":"b"}\n{"ref":"c"}\n');
  });

  test("jsonl files with no remote content yet just take the local lines", () => {
    const local = '{"ref":"a"}\n{"ref":"b"}\n';

    const merged = mergeFileContent(
      "precomputed/rsi_state/context_usage_log.jsonl", undefined, local);

    expect(merged).toEqual('{"ref":"a"}\n{"ref":"b"}\n');
  });
});

describe("extractPagesFromPaths", () => {
  test("extracts unique pages from ai_additions, generation_records, and context_usage_log", () => {
    const paths = [
      "precomputed/ai_additions/Menachot 90a.json",
      "precomputed/rsi_state/generation_records/rashi_tosafot_translation/Menachot 90a.json",
      "precomputed/rsi_state/context_usage_log/rashi_tosafot_translation/Chullin 2b.jsonl",
      "precomputed/rsi_state/context_usage_log.jsonl",
      "precomputed/ai_additions/UnknownBook 1a.json",
    ];
    expect(extractPagesFromPaths(paths)).toEqual(["Menachot 90a", "Chullin 2b"]);
  });
});

describe("formatPrTitle", () => {
  test("formats title with task, backend, and pages without RSI prefix", () => {
    expect(formatPrTitle("rashi_tosafot_translation", "claude", ["Menachot 90a"]))
      .toBe("rashi_tosafot_translation | claude: Menachot 90a");
  });

  test("merges adjacent pages in title", () => {
    expect(formatPrTitle("rashi_tosafot_translation", "agy", ["Menachot 90a", "Menachot 90b"]))
      .toBe("rashi_tosafot_translation | agy: Menachot 90a-90b");
  });

  test("formats title with multiple tractates", () => {
    expect(formatPrTitle("rashi_tosafot_translation", "claude", ["Menachot 90a", "Menachot 90b", "Chullin 2a"]))
      .toBe("rashi_tosafot_translation | claude: Chullin 2a, Menachot 90a-90b");
  });

  test("handles empty pages", () => {
    expect(formatPrTitle("rashi_tosafot_translation", "claude", []))
      .toBe("rashi_tosafot_translation | claude");
  });

  test("truncates gracefully if page list is long", () => {
    const pages = [
      "Menachot 90a", "Chullin 2a", "Shabbat 15a", "Berakhot 2a", "Pesachim 10a",
      "Yoma 20a", "Sukkah 30a",
    ];
    const title = formatPrTitle("rashi_tosafot_translation", "claude", pages);
    expect(title.startsWith("rashi_tosafot_translation | claude: ")).toBe(true);
    expect(title.startsWith("RSI")).toBe(false);
  });
});

describe("parseDiffStats", () => {
  test("parses edit mode (add, delete, modify) and added/deleted lines per file", () => {
    const numstat = [
      "15\t2\tprecomputed/ai_additions/Menachot 90a.json",
      "30\t0\t\"precomputed/ai_additions/Chullin 2b.json\"",
      "0\t10\tprecomputed/ai_additions/Deleted.json",
      "",
    ].join("\n");
    const nameStatus = [
      "M\tprecomputed/ai_additions/Menachot 90a.json",
      "A\t\"precomputed/ai_additions/Chullin 2b.json\"",
      "D\tprecomputed/ai_additions/Deleted.json",
      "",
    ].join("\n");

    const stats = parseDiffStats(numstat, nameStatus);
    expect(stats).toEqual([
      {
        path: "precomputed/ai_additions/Chullin 2b.json",
        mode: "add",
        addedLines: 30,
        deletedLines: 0,
      },
      {
        path: "precomputed/ai_additions/Deleted.json",
        mode: "delete",
        addedLines: 0,
        deletedLines: 10,
      },
      {
        path: "precomputed/ai_additions/Menachot 90a.json",
        mode: "modify",
        addedLines: 15,
        deletedLines: 2,
      },
    ]);
  });
});

describe("formatDiffStatsTable", () => {
  test("generates rich markdown table with headers, modes, line counts, and totals without RSI prefix", () => {
    const stats: FileEditStat[] = [
      {
        path: "precomputed/ai_additions/Menachot 90a.json",
        mode: "modify",
        addedLines: 15,
        deletedLines: 2,
      },
      {
        path: "precomputed/ai_additions/Chullin 2b.json",
        mode: "add",
        addedLines: 30,
        deletedLines: 0,
      },
    ];

    const table = formatDiffStatsTable(stats);
    expect(table).toContain("### File Changes");
    expect(table).not.toContain("RSI");
    expect(table).toContain("| File | Mode | Added Lines | Deleted Lines |");
    expect(table).toContain("| `precomputed/ai_additions/Menachot 90a.json` | modify | +15 | -2 |");
    expect(table).toContain("| `precomputed/ai_additions/Chullin 2b.json` | add | +30 | -0 |");
    expect(table).toContain("| **Total** | | **+45** | **-2** |");
  });
});

function fakeDeps(overrides: Partial<CommitPendingDeps> = {}): CommitPendingDeps {
  return {
    gitStatusPorcelain: async () => " M precomputed/ai_additions/Zevachim 16a.json",
    currentBranch: async () => "rsi-feature-branch",
    findOpenPr: async () => undefined,
    commitPendingState: async (_message: string) => true,
    push: async () => {},
    openPr: async () => {},
    ...overrides,
  };
}

describe("commitAndPushPendingCandidates", () => {
  test("no-ops when nothing changed under the managed paths", async () => {
    const commitPendingState = jest.fn();
    await commitAndPushPendingCandidates("msg", fakeDeps({
      gitStatusPorcelain: async () => "",
      commitPendingState,
    }));

    expect(commitPendingState).not.toHaveBeenCalled();
  });

  test("throws error if run on base branch", async () => {
    await expect(commitAndPushPendingCandidates("msg", fakeDeps({
      currentBranch: async () => "base",
    }))).rejects.toThrow('Cannot commit pending candidates directly to "base"');
  });

  test("throws error if run on detached HEAD", async () => {
    await expect(commitAndPushPendingCandidates("msg", fakeDeps({
      currentBranch: async () => "HEAD",
    }))).rejects.toThrow('Cannot commit pending candidates directly to "HEAD"');
  });

  test("commits, pushes, and opens PR with task, backend, and pages in title", async () => {
    const commitPendingState = jest.fn(async (_message: string) => true);
    const push = jest.fn();
    const openPr = jest.fn(async (_branch: string, _title: string, _body: string) => 123);
    const getCurrentHeadSha = jest.fn()
      .mockResolvedValueOnce("sha1")
      .mockResolvedValueOnce("sha2");
    const getDiffStats = jest.fn(async () => ({
      numstat: "10\t0\tprecomputed/ai_additions/Zevachim 16a.json\n",
      nameStatus: "M\tprecomputed/ai_additions/Zevachim 16a.json\n",
    }));
    const addPrComment = jest.fn();

    await commitAndPushPendingCandidates({
      task: "rashi_tosafot_translation",
      backend: "claude",
      message: "Translate Zevachim 16a",
    }, fakeDeps({
      currentBranch: async () => "rsi-zevachim",
      findOpenPr: async () => undefined,
      commitPendingState,
      push,
      openPr,
      getCurrentHeadSha,
      getDiffStats,
      addPrComment,
    }));

    expect(commitPendingState).toHaveBeenCalledWith("Translate Zevachim 16a");
    expect(push).toHaveBeenCalled();
    expect(openPr).toHaveBeenCalledWith(
      "rsi-zevachim",
      "rashi_tosafot_translation | claude: Zevachim 16a",
      expect.any(String),
    );
    expect(addPrComment).toHaveBeenCalledWith(
      123,
      expect.stringContaining("| `precomputed/ai_additions/Zevachim 16a.json` | modify | +10 | -0 |"),
    );
  });

  test("updates PR title and adds comment when PR is already open", async () => {
    const commitPendingState = jest.fn(async (_message: string) => true);
    const push = jest.fn();
    const openPr = jest.fn();
    const updatePrTitle = jest.fn();
    const getCurrentHeadSha = jest.fn()
      .mockResolvedValueOnce("sha1")
      .mockResolvedValueOnce("sha2");
    const getDiffStats = jest.fn(async () => ({
      numstat: "5\t1\tprecomputed/ai_additions/Zevachim 16a.json\n",
      nameStatus: "M\tprecomputed/ai_additions/Zevachim 16a.json\n",
    }));
    const addPrComment = jest.fn();

    await commitAndPushPendingCandidates({
      task: "rashi_tosafot_translation",
      backend: "claude",
      message: "More candidates",
    }, fakeDeps({
      currentBranch: async () => "rsi-zevachim",
      findOpenPr: async () => ({number: 42, title: "old title"}),
      commitPendingState,
      push,
      openPr,
      updatePrTitle,
      getCurrentHeadSha,
      getDiffStats,
      addPrComment,
    }));

    expect(openPr).not.toHaveBeenCalled();
    expect(updatePrTitle).toHaveBeenCalledWith(
      42,
      "rashi_tosafot_translation | claude: Zevachim 16a",
    );
    expect(addPrComment).toHaveBeenCalledWith(
      42,
      expect.stringContaining("| `precomputed/ai_additions/Zevachim 16a.json` | modify | +5 | -1 |"),
    );
  });

  test("does not push or open PR if worktree has nothing to commit", async () => {
    const push = jest.fn();
    const openPr = jest.fn();
    await commitAndPushPendingCandidates("No changes", fakeDeps({
      commitPendingState: async () => false,
      push,
      openPr,
    }));

    expect(push).not.toHaveBeenCalled();
    expect(openPr).not.toHaveBeenCalled();
  });
});

describe("makeRealCommitPendingDeps", () => {
  test("constructs an object satisfying CommitPendingDeps", () => {
    const deps = makeRealCommitPendingDeps({debug: true});
    expect(typeof deps.gitStatusPorcelain).toBe("function");
    expect(typeof deps.currentBranch).toBe("function");
    expect(typeof deps.findOpenPr).toBe("function");
    expect(typeof deps.commitPendingState).toBe("function");
    expect(typeof deps.push).toBe("function");
    expect(typeof deps.openPr).toBe("function");
  });

  test("realCommitPendingDeps is initialized with default options", () => {
    expect(typeof realCommitPendingDeps.gitStatusPorcelain).toBe("function");
  });
});
