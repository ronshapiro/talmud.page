import * as fs from "fs";
import {
  aiEditsForPage,
  aiEditsPath,
  writeAiEdit,
} from "./ai_edits";

const TEST_PAGE = "__Test_Book__ 2a";
const TEST_MULTI_WORD_PAGE = "__Test Complex Book__ 10b";

afterEach(() => {
  fs.rmSync(aiEditsPath(TEST_PAGE), {force: true});
  fs.rmSync("precomputed/ai_additions/__Test_Book__", {force: true, recursive: true});
  fs.rmSync(aiEditsPath(TEST_MULTI_WORD_PAGE), {force: true});
  fs.rmSync("precomputed/ai_additions/__Test Complex Book__", {force: true, recursive: true});
});

test("aiEditsPath splits page ref into book directory and page filename", () => {
  expect(aiEditsPath("Berakhot 2a")).toBe("precomputed/ai_additions/Berakhot/2a.json");
  expect(aiEditsPath("Bava Batra 76b")).toBe("precomputed/ai_additions/Bava Batra/76b.json");
  expect(aiEditsPath("Rosh Hashanah 10a")).toBe("precomputed/ai_additions/Rosh Hashanah/10a.json");
  expect(aiEditsPath("NoSpace")).toBe("precomputed/ai_additions/NoSpace.json");
});

test("aiEditsForPage returns undefined when the file does not exist", () => {
  expect(aiEditsForPage(TEST_PAGE)).toBeUndefined();
});

test("writeAiEdit creates directory and writes edit, and aiEditsForPage reads it back", () => {
  const commentRef = "Rashi on __Test Complex Book__ 10b:1:1";
  writeAiEdit(TEST_MULTI_WORD_PAGE, commentRef, {
    hebrew: "עברית",
    english: "english",
    status: "pending",
  });

  const edits = aiEditsForPage(TEST_MULTI_WORD_PAGE);
  expect(edits).toEqual({
    [commentRef]: {
      hebrew: "עברית",
      english: "english",
      status: "pending",
    },
  });
});
