import * as fs from "fs";
import * as path from "path";
import {Amud} from "../apiTypes";
import {Book} from "../books";
import {cachedOutputFilePath} from "../cached_outputs";
import {writeJson} from "../util/json_files";
import {
  extractRequestedRefs,
  fetchWikipedia,
  findBaseSegment,
  getCommentRefs,
  getNeighborSegments,
  getPriorSugyaSkeleton,
  getRefs,
  MAX_CHARS_PER_CALL,
  MAX_SEARCH_MATCHES,
  MAX_REFS_PER_CALL,
  parseRefLocation,
  resetPageIndexCacheForTests,
  searchPage,
} from "./context_fetch";

const TEST_BOOK = {canonicalName: "Zevachim"} as unknown as Book; // a real, registered book name
// A real, valid amud — parseRefLocation now validates pages against the real book registry (see
// context_fetch.ts), so a made-up page string like the previous "__ctxfetch_test__a" no longer
// resolves. This does mean the fixture below writes to the same cached_outputs path a real cache
// run would use — see the beforeAll/afterAll pair further down, which preserves and restores any
// real data already at that path rather than assuming it's safe to clobber.
const SECTION = "2a";

function amud(): Amud {
  return {
    id: `Zevachim ${SECTION}`,
    sections: [
      {
        ref: `Zevachim ${SECTION}:1`,
        he: "ראשון",
        en: "first",
        commentary: {
          Rashi: {comments: [{
            ref: `Rashi on Zevachim ${SECTION}:1:1`,
            he: "פירוש",
            en: "explanation",
            sourceRef: `Zevachim ${SECTION}:1`,
            sourceHeRef: `Zevachim ${SECTION}:1`,
            commentary: {
              Rashi: {comments: [{
                ref: `Rashi on Zevachim ${SECTION}:1:1:1`,
                he: "מקונן",
                en: "nested",
                sourceRef: `Rashi on Zevachim ${SECTION}:1:1`,
                sourceHeRef: `Rashi on Zevachim ${SECTION}:1:1`,
              }]},
            },
          }]},
        },
      },
      {ref: `Zevachim ${SECTION}:2`, he: "שני", en: "second"},
      {ref: `Zevachim ${SECTION}:3`, he: "שלישי", en: "third"},
    ],
  };
}

const filePath = cachedOutputFilePath(TEST_BOOK, SECTION);
const NEXT_SECTION = "2b";
const nextFilePath = cachedOutputFilePath(TEST_BOOK, NEXT_SECTION);
const preexistingContent = new Map<string, string>();

beforeAll(() => {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  // Preserve whatever's really there (if anything — a local `cache_all_api_requests.ts` run would
  // populate these exact paths) rather than assuming it's safe to overwrite/delete. See the
  // comment on SECTION above for why this test can no longer use a made-up path.
  for (const p of [filePath, nextFilePath]) {
    if (fs.existsSync(p)) preexistingContent.set(p, fs.readFileSync(p, "utf-8"));
  }
});

afterAll(() => {
  for (const p of [filePath, nextFilePath]) {
    const content = preexistingContent.get(p);
    if (content !== undefined) {
      fs.writeFileSync(p, content);
    } else {
      fs.rmSync(p, {force: true});
    }
  }
});

beforeEach(() => {
  resetPageIndexCacheForTests();
});

// Per-test isolation (some tests rely on the file not existing yet) — the true pre-existing
// content, if any, is restored once by afterAll above, not on every test.
afterEach(() => {
  fs.rmSync(filePath, {force: true});
  fs.rmSync(nextFilePath, {force: true});
});

function nextAmud(): Amud {
  return {
    id: `Zevachim ${NEXT_SECTION}`,
    sections: [
      {
        ref: `Zevachim ${NEXT_SECTION}:1`,
        he: "רְבִיעִי",
        en: "fourth",
        commentary: {
          "Mesorat Hashas": {comments: [{
            ref: "Sukkah 53b:7-9",
            he: "מקביל",
            en: "parallel",
            sourceRef: "Sukkah 53b",
            sourceHeRef: "Sukkah 53b",
          }]},
          Rashi: {comments: [{
            ref: `Rashi on Zevachim ${NEXT_SECTION}:1:1`,
            he: "<b>רביעי</b> - כדאמרן לעיל:",
            en: "as we said above",
            sourceRef: `Zevachim ${NEXT_SECTION}:1`,
            sourceHeRef: `Zevachim ${NEXT_SECTION}:1`,
          }]},
          Steinsaltz: {comments: [{
            ref: `Steinsaltz on Zevachim ${NEXT_SECTION}:1`,
            he: "כדאמרן",
            en: "",
            sourceRef: `Zevachim ${NEXT_SECTION}:1`,
            sourceHeRef: `Zevachim ${NEXT_SECTION}:1`,
          }]},
        },
      },
      {ref: `Zevachim ${NEXT_SECTION}:2`, he: "חמישי", en: "fifth"},
    ],
  };
}

describe("parseRefLocation", () => {
  test("parses a base segment ref", () => {
    expect(parseRefLocation("Zevachim 2a:1")).toEqual({
      book: expect.objectContaining({canonicalName: "Zevachim"}),
      page: "2a",
    });
  });

  test("parses a commentary ref via its ' on ' suffix", () => {
    expect(parseRefLocation("Rashi on Zevachim 2a:1:1")).toEqual({
      book: expect.objectContaining({canonicalName: "Zevachim"}),
      page: "2a",
    });
  });

  test("handles a multi-word book name", () => {
    expect(parseRefLocation("Tosafot on Bava Kamma 5b:2:1")).toEqual({
      book: expect.objectContaining({canonicalName: "Bava Kamma"}),
      page: "5b",
    });
  });

  test("returns undefined for an unrecognized book", () => {
    expect(parseRefLocation("Nonexistent Book 2a:1")).toBeUndefined();
  });
});

describe("getRefs", () => {
  test("returns an error for a ref pointing at an uncached page", () => {
    const result = getRefs([`Zevachim ${SECTION}:1`]);
    expect(result.entries).toEqual([{ref: `Zevachim ${SECTION}:1`, error: "not found on the cached page"}]);
  });

  test("returns he/en for a base segment ref", () => {
    writeJson(filePath, amud());
    const result = getRefs([`Zevachim ${SECTION}:1`]);
    expect(result.entries).toEqual([
      {ref: `Zevachim ${SECTION}:1`, he: "ראשון", en: "first"},
    ]);
  });

  test("finds a commentary comment, including nested comment-on-comment", () => {
    writeJson(filePath, amud());
    const result = getRefs([
      `Rashi on Zevachim ${SECTION}:1:1`,
      `Rashi on Zevachim ${SECTION}:1:1:1`,
    ]);
    expect(result.entries).toEqual([
      {ref: `Rashi on Zevachim ${SECTION}:1:1`, he: "פירוש", en: "explanation"},
      {ref: `Rashi on Zevachim ${SECTION}:1:1:1`, he: "מקונן", en: "nested"},
    ]);
  });

  test("reports an error for a ref that isn't found on an otherwise-cached page", () => {
    writeJson(filePath, amud());
    const result = getRefs([`Zevachim ${SECTION}:99`]);
    expect(result.entries).toEqual([{ref: `Zevachim ${SECTION}:99`, error: "not found on the cached page"}]);
  });

  test("rejects a request over the per-call ref limit", () => {
    const refs = Array.from({length: MAX_REFS_PER_CALL + 1}, (_, i) => `Zevachim ${SECTION}:${i}`);
    const result = getRefs(refs);
    expect(result.entries).toEqual([]);
    expect(result.error).toMatch(/over the .* limit/);
  });

  test("rejects a request whose combined text exceeds the character cap", () => {
    const bigAmud = amud();
    bigAmud.sections[0].he = "א".repeat(MAX_CHARS_PER_CALL + 1);
    writeJson(filePath, bigAmud);
    const result = getRefs([`Zevachim ${SECTION}:1`]);
    expect(result.entries).toEqual([]);
    expect(result.error).toMatch(/over the .*-character limit/);
  });

  test("replaces huge base64 image data URIs with placeholders and temp file locations so getRefs stays under the character cap", () => {
    const hugeBase64Payload = "A".repeat(MAX_CHARS_PER_CALL + 1000);
    const amudWithImage = amud();
    const imageHtml = `הגה"ה <img src="data:image/png;base64,${hugeBase64Payload}"> ע"כ`;
    amudWithImage.sections[0].commentary!.Rashi.comments[0].he = imageHtml;
    writeJson(filePath, amudWithImage);

    const result = getRefs([`Rashi on Zevachim ${SECTION}:1:1`]);
    expect(result.error).toBeUndefined();
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].ref).toBe(`Rashi on Zevachim ${SECTION}:1:1`);
    expect(result.entries[0].en).toBe("explanation");
    expect(result.entries[0].he).toContain('הגה"ה <img src="IMAGE_PLACEHOLDER_1"> ע"כ');
    expect(result.entries[0].he).toMatch(
      new RegExp(
        `Attached image\\(s\\):\\n- IMAGE_PLACEHOLDER_1: @.*\\/Rashi_on_Zevachim_${SECTION}_1_1_IMAGE_PLACEHOLDER_1\\.png$`,
      ),
    );
  });
});

describe("getNeighborSegments", () => {
  test("returns segments before and after the given ref", () => {
    writeJson(filePath, amud());
    const result = getNeighborSegments(`Zevachim ${SECTION}:2`, 1, 1);
    expect(result.entries.map(e => e.ref)).toEqual([
      `Zevachim ${SECTION}:1`, `Zevachim ${SECTION}:2`, `Zevachim ${SECTION}:3`,
    ]);
  });

  test("clamps at the start of the book", () => {
    writeJson(filePath, amud());
    const result = getNeighborSegments(`Zevachim ${SECTION}:1`, 5, 0);
    expect(result.entries.map(e => e.ref)).toEqual([`Zevachim ${SECTION}:1`]);
  });

  test("continues into the previous amud's last segments", () => {
    writeJson(filePath, amud());
    writeJson(nextFilePath, nextAmud());
    const result = getNeighborSegments(`Zevachim ${NEXT_SECTION}:1`, 2, 0);
    expect(result.entries.map(e => e.ref)).toEqual([
      `Zevachim ${SECTION}:2`, `Zevachim ${SECTION}:3`, `Zevachim ${NEXT_SECTION}:1`,
    ]);
  });

  test("continues into the next amud's first segments", () => {
    writeJson(filePath, amud());
    writeJson(nextFilePath, nextAmud());
    const result = getNeighborSegments(`Zevachim ${SECTION}:3`, 0, 2);
    expect(result.entries.map(e => e.ref)).toEqual([
      `Zevachim ${SECTION}:3`, `Zevachim ${NEXT_SECTION}:1`, `Zevachim ${NEXT_SECTION}:2`,
    ]);
  });

  test("stops at an adjacent amud that isn't cached", () => {
    writeJson(filePath, amud());
    const result = getNeighborSegments(`Zevachim ${SECTION}:3`, 0, 2);
    expect(result.entries.map(e => e.ref)).toEqual([`Zevachim ${SECTION}:3`]);
  });

  test("errors when given a commentary ref instead of a base segment", () => {
    writeJson(filePath, amud());
    const result = getNeighborSegments(`Rashi on Zevachim ${SECTION}:1:1`);
    expect(result.entries).toEqual([]);
    expect(result.error).toMatch(/not a base Gemara segment/);
  });

  test("replaces base64 image data URIs with placeholders and temp file locations in neighbor segments", () => {
    const amudWithImage = amud();
    amudWithImage.sections[0].he = 'ציור <img src="data:image/png;base64,iVBORw0KGgo=">';
    writeJson(filePath, amudWithImage);

    const result = getNeighborSegments(`Zevachim ${SECTION}:1`, 0, 0);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].ref).toBe(`Zevachim ${SECTION}:1`);
    expect(result.entries[0].en).toBe("first");
    expect(result.entries[0].he).toContain('ציור <img src="IMAGE_PLACEHOLDER_1">');
    expect(result.entries[0].he).toMatch(
      new RegExp(
        `Attached image\\(s\\):\\n- IMAGE_PLACEHOLDER_1: @.*\\/Zevachim_${SECTION}_1_IMAGE_PLACEHOLDER_1\\.png$`,
      ),
    );
  });
});

describe("findBaseSegment", () => {
  test("returns the Gemara segment a comment is attached to", () => {
    writeJson(filePath, amud());
    expect(findBaseSegment(`Rashi on Zevachim ${SECTION}:1:1`)).toEqual({
      ref: `Zevachim ${SECTION}:1`, he: "ראשון", en: "first",
    });
  });
});

describe("getCommentRefs", () => {
  test("lists a segment's comment refs by commentary", () => {
    writeJson(nextFilePath, nextAmud());
    expect(getCommentRefs(`Zevachim ${NEXT_SECTION}:1`)).toEqual({commentary: {
      "Mesorat Hashas": ["Sukkah 53b:7-9"],
      Rashi: [`Rashi on Zevachim ${NEXT_SECTION}:1:1`],
      Steinsaltz: [`Steinsaltz on Zevachim ${NEXT_SECTION}:1`],
    }});
  });

  test("filters to one commentary", () => {
    writeJson(nextFilePath, nextAmud());
    expect(getCommentRefs(`Zevachim ${NEXT_SECTION}:1`, "Mesorat Hashas"))
      .toEqual({commentary: {"Mesorat Hashas": ["Sukkah 53b:7-9"]}});
    expect(getCommentRefs(`Zevachim ${NEXT_SECTION}:1`, "Verses").error).toMatch(/no Verses/);
  });

  test("lists the comments nested on a comment", () => {
    writeJson(filePath, amud());
    expect(getCommentRefs(`Rashi on Zevachim ${SECTION}:1:1`))
      .toEqual({commentary: {Rashi: [`Rashi on Zevachim ${SECTION}:1:1:1`]}});
  });

  test("errors for a ref that isn't on its page", () => {
    writeJson(filePath, amud());
    expect(getCommentRefs(`Zevachim ${SECTION}:99`).error).toMatch(/not found/);
  });
});

describe("getRefs --on", () => {
  test("finds a comment whose ref points into another work on the given page", () => {
    writeJson(nextFilePath, nextAmud());
    expect(getRefs(["Sukkah 53b:7-9"], "both", `Zevachim ${NEXT_SECTION}:1`).entries)
      .toEqual([{ref: "Sukkah 53b:7-9", he: "מקביל", en: "parallel"}]);
  });

  test("falls back to the ref's own page", () => {
    writeJson(filePath, amud());
    writeJson(nextFilePath, nextAmud());
    expect(getRefs([`Zevachim ${SECTION}:2`], "he", `Zevachim ${NEXT_SECTION}:1`).entries)
      .toEqual([{ref: `Zevachim ${SECTION}:2`, he: "שני"}]);
  });

  test("returns undefined when the page isn't cached", () => {
    expect(findBaseSegment(`Rashi on Zevachim ${SECTION}:1:1`)).toBeUndefined();
  });
});

describe("getRefs with segment ranges", () => {
  test("joins a range on one page", () => {
    writeJson(filePath, amud());
    expect(getRefs([`Zevachim ${SECTION}:2-3`]).entries).toEqual([
      {ref: `Zevachim ${SECTION}:2-3`, he: "שני שלישי", en: "second third"},
    ]);
  });

  test("joins a range that crosses into the next amud", () => {
    writeJson(filePath, amud());
    writeJson(nextFilePath, nextAmud());
    expect(getRefs([`Zevachim ${SECTION}:3-${NEXT_SECTION}:1`]).entries).toEqual([
      {ref: `Zevachim ${SECTION}:3-${NEXT_SECTION}:1`, he: "שלישי רְבִיעִי", en: "third fourth"},
    ]);
  });

  test("suggests --lang and search for a range that's over the size cap", () => {
    writeJson(filePath, {
      ...amud(),
      sections: amud().sections.map(segment => ({...segment, en: "a".repeat(MAX_CHARS_PER_CALL)})),
    });
    const {error} = getRefs([`Zevachim ${SECTION}:1-2`]);
    expect(error).toMatch(/--lang he/);
    expect(error).toMatch(/search the range/);
  });

  test("--lang he fits a range whose English is over the size cap", () => {
    writeJson(filePath, {
      ...amud(),
      sections: amud().sections.map(segment => ({...segment, en: "a".repeat(MAX_CHARS_PER_CALL)})),
    });
    expect(getRefs([`Zevachim ${SECTION}:2-3`], "he").entries).toEqual([
      {ref: `Zevachim ${SECTION}:2-3`, he: "שני שלישי"},
    ]);
  });

  test("errors when a page in the range isn't cached", () => {
    writeJson(filePath, amud());
    expect(getRefs([`Zevachim ${SECTION}:3-${NEXT_SECTION}:1`]).entries[0].error)
      .toMatch(/not cached/);
  });
});

describe("getRefs --lang", () => {
  test("returns only the requested language", () => {
    writeJson(filePath, amud());
    expect(getRefs([`Zevachim ${SECTION}:2`], "he").entries).toEqual([
      {ref: `Zevachim ${SECTION}:2`, he: "שני"},
    ]);
    expect(getRefs([`Zevachim ${SECTION}:2`], "en").entries).toEqual([
      {ref: `Zevachim ${SECTION}:2`, en: "second"},
    ]);
  });

  test("keeps per-ref errors", () => {
    writeJson(filePath, amud());
    expect(getRefs([`Zevachim ${SECTION}:99`], "he").entries[0].error).toMatch(/not found/);
  });
});

describe("searchPage", () => {
  test("finds Hebrew in segments and Rashi/Tosafot, ignoring vowels and HTML", () => {
    writeJson(nextFilePath, nextAmud());
    expect(searchPage(`Zevachim ${NEXT_SECTION}`, "רביעי").matches.map(m => m.ref)).toEqual([
      `Zevachim ${NEXT_SECTION}:1`, `Rashi on Zevachim ${NEXT_SECTION}:1:1`,
    ]);
  });

  test("skips commentaries other than Rashi and Tosafot", () => {
    writeJson(nextFilePath, nextAmud());
    expect(searchPage(`Zevachim ${NEXT_SECTION}`, "כדאמרן").matches).toEqual([
      {ref: `Rashi on Zevachim ${NEXT_SECTION}:1:1`, snippet: "רביעי - כדאמרן לעיל:"},
    ]);
  });

  test("searches English for a non-Hebrew query", () => {
    writeJson(nextFilePath, nextAmud());
    expect(searchPage(`Zevachim ${NEXT_SECTION}`, "FIFTH").matches.map(m => m.ref))
      .toEqual([`Zevachim ${NEXT_SECTION}:2`]);
  });

  test("truncates long result lists", () => {
    const many: Amud = {
      id: `Zevachim ${NEXT_SECTION}`,
      sections: Array.from({length: MAX_SEARCH_MATCHES + 5}, (_, i) => ({
        ref: `Zevachim ${NEXT_SECTION}:${i + 1}`, he: "מילה", en: "word",
      })),
    };
    writeJson(nextFilePath, many);
    const result = searchPage(`Zevachim ${NEXT_SECTION}`, "מילה");
    expect(result.matches).toHaveLength(MAX_SEARCH_MATCHES);
    expect(result.truncated).toBe(true);
  });

  test("errors for an uncached page", () => {
    expect(searchPage(`Zevachim ${NEXT_SECTION}`, "מילה").error).toMatch(/not cached/);
  });

  test("searches only within a segment range, across amudim", () => {
    writeJson(filePath, amud());
    writeJson(nextFilePath, nextAmud());
    expect(searchPage(`Zevachim ${SECTION}:3-${NEXT_SECTION}:1`, "רביעי").matches.map(m => m.ref))
      .toEqual([`Zevachim ${NEXT_SECTION}:1`, `Rashi on Zevachim ${NEXT_SECTION}:1:1`]);
    expect(searchPage(`Zevachim ${SECTION}:3-${NEXT_SECTION}:1`, "שני").matches).toEqual([]);
  });

  test("errors when a page in the range isn't cached", () => {
    writeJson(filePath, amud());
    expect(searchPage(`Zevachim ${SECTION}:3-${NEXT_SECTION}:1`, "רביעי").error)
      .toMatch(/not cached/);
  });
});

describe("getPriorSugyaSkeleton", () => {
  test("returns an error when there's no sugya data for the book", () => {
    // Sugyot are only precomputed for Talmud masechtot — Genesis is a real registered book with
    // no precomputed/sugyot/Genesis.json, so this exercises the "book has no data at all" branch.
    const result = getPriorSugyaSkeleton("Genesis 1:1");
    expect(result.sugyot).toEqual([]);
    expect(result.error).toBeDefined();
  });

  test("gives each prior sugya a range ref usable by get-refs and search", () => {
    // Real precomputed/sugyot/Arakhin.json data: one sugya within 8b, one spanning 8b-10a.
    expect(getPriorSugyaSkeleton("Arakhin 10a:2", 2).sugyot.map(sugya => sugya.range))
      .toEqual(["Arakhin 8b:15-16", "Arakhin 8b:17-10a:1"]);
  });

  test("returns the sugyot immediately before the given page, for a real book", () => {
    // Zevachim 2a is the very first page — there's nothing before it, so this exercises the
    // "found the page but there's no prior sugya" edge rather than requiring a fixture.
    const result = getPriorSugyaSkeleton("Zevachim 2a:1", 2);
    expect(result.sugyot).toEqual([]);
    expect(result.error).toBeUndefined();
  });
});

describe("extractRequestedRefs", () => {
  test("extracts refs from a get-refs JSON-array Bash call", () => {
    const refs = extractRequestedRefs([
      {
        name: "Bash",
        input: {
          command: "npx ts-node rsi_orchestrator/context_fetch_cli.ts get-refs "
            + "'[\"Rashi on Zevachim 2a:1:1\",\"Tosafot on Zevachim 2a:1:1\"]'",
        },
      },
    ]);
    expect(refs.sort()).toEqual(["Rashi on Zevachim 2a:1:1", "Tosafot on Zevachim 2a:1:1"]);
  });

  test("extracts a single ref from a get-neighbors Bash call", () => {
    const refs = extractRequestedRefs([
      {
        name: "Bash",
        input: {
          command: "npx ts-node rsi_orchestrator/context_fetch_cli.ts get-neighbors "
            + "\"Zevachim 2a:3\" --before 1 --after 1",
        },
      },
    ]);
    expect(refs).toEqual(["Zevachim 2a:3"]);
  });

  test("ignores non-Bash and unrelated Bash tool uses", () => {
    const refs = extractRequestedRefs([
      {name: "Read", input: {file_path: "foo.json"}},
      {name: "Bash", input: {command: "echo hello"}},
      {name: "run_command", input: {CommandLine: "echo hello"}},
    ]);
    expect(refs).toEqual([]);
  });

  test("extracts refs from a get-refs run_command tool use (agy)", () => {
    const refs = extractRequestedRefs([
      {
        name: "run_command",
        input: {
          CommandLine: "npx ts-node rsi_orchestrator/context_fetch_cli.ts get-refs "
            + "'[\"Rashi on Menachot 95a:1:1\"]'",
        },
      },
    ]);
    expect(refs).toEqual(["Rashi on Menachot 95a:1:1"]);
  });

  test("deduplicates refs requested more than once", () => {
    const refs = extractRequestedRefs([
      {
        name: "Bash",
        input: {
          command: "npx ts-node rsi_orchestrator/context_fetch_cli.ts get-refs '[\"Zevachim 2a:1\"]'",
        },
      },
      {
        name: "run_command",
        input: {
          CommandLine: "npx ts-node rsi_orchestrator/context_fetch_cli.ts get-neighbors \"Zevachim 2a:1\"",
        },
      },
    ]);
    expect(refs).toEqual(["Zevachim 2a:1"]);
  });

  test("ignores get-comment-refs commands when extracting refs", () => {
    expect(extractRequestedRefs([{
      name: "Bash",
      input: {command: "npx ts-node rsi_orchestrator/context_fetch_cli.ts get-comment-refs \"Zevachim 2a:1\""},
    }])).toEqual([]);
  });

  test("ignores search commands when extracting refs", () => {
    expect(extractRequestedRefs([{
      name: "Bash",
      input: {command: "npx ts-node rsi_orchestrator/context_fetch_cli.ts search \"Sukkah 53b\" \"חליל\""},
    }])).toEqual([]);
  });

  test("ignores wikipedia commands when extracting refs", () => {
    const refs = extractRequestedRefs([
      {
        name: "Bash",
        input: {
          command: "npx ts-node rsi_orchestrator/context_fetch_cli.ts wikipedia \"Fenugreek\"",
        },
      },
      {
        name: "run_command",
        input: {
          CommandLine: "npx ts-node rsi_orchestrator/context_fetch_cli.ts get-refs '[\"Zevachim 2a:1\"]'",
        },
      },
    ]);
    expect(refs).toEqual(["Zevachim 2a:1"]);
  });
});

describe("fetchWikipedia", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("returns parsed summary on success", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        title: "Fenugreek",
        description: "Plant species",
        extract: "Fenugreek is an annual plant in the family Fabaceae.",
        content_urls: {desktop: {page: "https://en.wikipedia.org/wiki/Fenugreek"}},
      }),
    } as unknown as Response);

    const res = await fetchWikipedia("Fenugreek");
    expect(res.title).toBe("Fenugreek");
    expect(res.description).toBe("Plant species");
    expect(res.extract).toContain("Fabaceae");
    expect(res.url).toBe("https://en.wikipedia.org/wiki/Fenugreek");
    expect(res.error).toBeUndefined();
  });

  test("returns error when article is not found", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as unknown as Response);

    const res = await fetchWikipedia("NonExistentArticle12345");
    expect(res.error).toContain("Wikipedia article not found");
  });

  test("returns error on network failure", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network offline"));

    const res = await fetchWikipedia("Fenugreek");
    expect(res.error).toContain("Network offline");
  });
});
