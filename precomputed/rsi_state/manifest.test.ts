import * as fs from "fs";
import {
  findDependentsOnPage,
  ManifestEntry,
  readManifestEntry,
  readManifestForPage,
  upsertManifestEntry,
} from "./manifest";

const TASK_TYPE = "__test_task_type__";
const PAGE = "__Test_Page__ 2a";

function entry(overrides: Partial<ManifestEntry> = {}): ManifestEntry {
  return {
    sourceRefs: ["Test 2a:1"],
    sourceText: "original text",
    model: "claude-opus-5",
    promptVersion: "v1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    dependsOn: [],
    ...overrides,
  };
}

afterEach(() => {
  fs.rmSync(`precomputed/rsi_state/manifest/${TASK_TYPE}`, {recursive: true, force: true});
});

test("readManifestForPage returns an empty object when nothing has been written", () => {
  expect(readManifestForPage(TASK_TYPE, PAGE)).toEqual({});
});

test("upsertManifestEntry then readManifestEntry round-trips", () => {
  upsertManifestEntry(TASK_TYPE, PAGE, "Test 2a:1", entry());
  expect(readManifestEntry(TASK_TYPE, PAGE, "Test 2a:1")).toEqual(entry());
});

test("upsertManifestEntry preserves other refs already on the page", () => {
  upsertManifestEntry(TASK_TYPE, PAGE, "Test 2a:1", entry());
  upsertManifestEntry(TASK_TYPE, PAGE, "Test 2a:2", entry({sourceRefs: ["Test 2a:2"]}));

  const manifest = readManifestForPage(TASK_TYPE, PAGE);
  expect(Object.keys(manifest).sort()).toEqual(["Test 2a:1", "Test 2a:2"]);
});

test("readManifestEntry returns undefined for a ref that was never written", () => {
  upsertManifestEntry(TASK_TYPE, PAGE, "Test 2a:1", entry());
  expect(readManifestEntry(TASK_TYPE, PAGE, "Test 2a:99")).toBeUndefined();
});

test("findDependentsOnPage finds refs that declare a dependency", () => {
  upsertManifestEntry(TASK_TYPE, PAGE, "Test 2a:1", entry());
  upsertManifestEntry(
    TASK_TYPE, PAGE, "Test 2a:2",
    entry({sourceRefs: ["Test 2a:2"], dependsOn: ["Test 2a:1"]}));
  upsertManifestEntry(
    TASK_TYPE, PAGE, "Test 2a:3",
    entry({sourceRefs: ["Test 2a:3"], dependsOn: []}));

  expect(findDependentsOnPage(TASK_TYPE, PAGE, "Test 2a:1").sort())
    .toEqual(["Test 2a:1", "Test 2a:2"]); // includes itself, since sourceRefs also matches
});
