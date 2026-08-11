import * as fs from "fs";
import * as path from "path";
import {Amud} from "../../apiTypes";
import {Book} from "../../books";
import {cachedOutputFilePath} from "../../cached_outputs";
import {writeJson} from "../../util/json_files";
import {buildPageSkeleton, formatPageSkeleton} from "./page_skeleton";

const TEST_BOOK = {canonicalName: "__Test_Book__"} as unknown as Book;
const SECTION = "2a";

function amud(overrides: Partial<Amud> = {}): Amud {
  return {
    id: "__Test_Book__ 2a",
    sections: [
      {
        ref: "__Test_Book__ 2a:1",
        he: "מילה ראשונה שנייה שלישית רביעית חמישית שישית שביעית שמינית תשיעית עשירית",
        en: "first second third fourth fifth sixth seventh eighth ninth tenth",
        commentary: {
          Rashi: {comments: [{
            ref: "Rashi on __Test_Book__ 2a:1:1",
            he: "א",
            en: "a",
            sourceRef: "__Test_Book__ 2a:1",
            sourceHeRef: "__Test_Book__ 2a:1",
          }]},
          Tosafot: {comments: [
            {
              ref: "Tosafot on __Test_Book__ 2a:1:1",
              he: "ב",
              en: "b",
              sourceRef: "__Test_Book__ 2a:1",
              sourceHeRef: "__Test_Book__ 2a:1",
            },
            {
              ref: "Tosafot on __Test_Book__ 2a:1:2",
              he: "ג",
              en: "c",
              sourceRef: "__Test_Book__ 2a:1",
              sourceHeRef: "__Test_Book__ 2a:1",
            },
          ]},
        },
      },
      {
        ref: "__Test_Book__ 2a:2",
        he: "<b>מילה</b> שנייה",
        en: "word two",
      },
    ],
    ...overrides,
  };
}

const filePath = cachedOutputFilePath(TEST_BOOK, SECTION);

beforeAll(() => {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
});

afterEach(() => {
  fs.rmSync(filePath, {force: true});
});

test("returns undefined when the page isn't cached", () => {
  expect(buildPageSkeleton(TEST_BOOK, SECTION)).toBeUndefined();
});

test("builds a segment per section, with commentary counts and a truncated preview", () => {
  writeJson(filePath, amud());
  const skeleton = buildPageSkeleton(TEST_BOOK, SECTION);
  expect(skeleton).toEqual({
    page: "__Test_Book__ 2a",
    segments: [
      {
        ref: "__Test_Book__ 2a:1",
        preview: "מילה ראשונה שנייה שלישית רביעית חמישית שישית שביעית...",
        commentary: {Rashi: 1, Tosafot: 2},
      },
      {
        ref: "__Test_Book__ 2a:2",
        preview: "מילה שנייה",
        commentary: {},
      },
    ],
  });
});

test("strips HTML tags from the preview", () => {
  writeJson(filePath, amud());
  const skeleton = buildPageSkeleton(TEST_BOOK, SECTION)!;
  expect(skeleton.segments[1].preview).toEqual("מילה שנייה");
});

test("formatPageSkeleton renders a compact, human/LLM-readable summary", () => {
  writeJson(filePath, amud());
  const skeleton = buildPageSkeleton(TEST_BOOK, SECTION)!;
  const formatted = formatPageSkeleton(skeleton);
  expect(formatted).toContain("__Test_Book__ 2a:1");
  expect(formatted).toContain("Rashi(1)");
  expect(formatted).toContain("Tosafot(2)");
  expect(formatted).toContain("__Test_Book__ 2a:2");
  expect(formatted).toContain("commentary: none");
});
