import * as fs from "fs";
import * as path from "path";
import {Amud} from "../apiTypes";
import {Book} from "../books";
import {cachedOutputFilePath} from "../cached_outputs";
import {writeJson} from "../util/json_files";
import {
  extractRequestedRefs,
  getNeighborSegments,
  getPriorSugyaSkeleton,
  getRefs,
  MAX_CHARS_PER_CALL,
  MAX_REFS_PER_CALL,
  parseRefLocation,
  resetPageIndexCacheForTests,
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
let preexistingContent: string | undefined;

beforeAll(() => {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  // Preserve whatever's really there (if anything — a local `cache_all_api_requests.ts` run would
  // populate this exact path) rather than assuming it's safe to overwrite/delete. See the comment
  // on SECTION above for why this test can no longer use a made-up path.
  if (fs.existsSync(filePath)) preexistingContent = fs.readFileSync(filePath, "utf-8");
});

afterAll(() => {
  if (preexistingContent !== undefined) {
    fs.writeFileSync(filePath, preexistingContent);
  } else {
    fs.rmSync(filePath, {force: true});
  }
});

beforeEach(() => {
  resetPageIndexCacheForTests();
});

// Per-test isolation (some tests rely on the file not existing yet) — the true pre-existing
// content, if any, is restored once by afterAll above, not on every test.
afterEach(() => {
  fs.rmSync(filePath, {force: true});
});

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
});

describe("getNeighborSegments", () => {
  test("returns segments before and after the given ref", () => {
    writeJson(filePath, amud());
    const result = getNeighborSegments(`Zevachim ${SECTION}:2`, 1, 1);
    expect(result.entries.map(e => e.ref)).toEqual([
      `Zevachim ${SECTION}:1`, `Zevachim ${SECTION}:2`, `Zevachim ${SECTION}:3`,
    ]);
  });

  test("clamps at the start of the page", () => {
    writeJson(filePath, amud());
    const result = getNeighborSegments(`Zevachim ${SECTION}:1`, 5, 0);
    expect(result.entries.map(e => e.ref)).toEqual([`Zevachim ${SECTION}:1`]);
  });

  test("errors when given a commentary ref instead of a base segment", () => {
    writeJson(filePath, amud());
    const result = getNeighborSegments(`Rashi on Zevachim ${SECTION}:1:1`);
    expect(result.entries).toEqual([]);
    expect(result.error).toMatch(/not a base Gemara segment/);
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
    ]);
    expect(refs).toEqual([]);
  });

  test("deduplicates refs requested more than once", () => {
    const refs = extractRequestedRefs([
      {
        name: "Bash",
        input: {command: "context_fetch_cli.ts get-refs '[\"Zevachim 2a:1\"]'"},
      },
      {
        name: "Bash",
        input: {command: "context_fetch_cli.ts get-refs '[\"Zevachim 2a:1\"]'"},
      },
    ]);
    expect(refs).toEqual(["Zevachim 2a:1"]);
  });
});
