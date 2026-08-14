import * as fs from "fs";
import {
  addSegmentationOverride,
  OUTPUT_DIR,
  SegmentationOverride,
  segmentationOverridesForPage,
  SegmentationSplitOverride,
} from "./segmentation_overrides";

const PAGE = "__Test_Book__ 2a";

afterEach(() => {
  fs.rmSync(`${OUTPUT_DIR}/${PAGE}.json`, {force: true});
});

function splitOverride(
  overrides: Partial<SegmentationSplitOverride> = {},
): SegmentationSplitOverride {
  return {
    kind: "split",
    level: "comment",
    originalRef: "Rashi on __Test_Book__ 2a:1:1",
    pieces: [
      {ref: "Rashi on __Test_Book__ 2a:1:1:split:1", hebrew: "א", english: "a"},
      {ref: "Rashi on __Test_Book__ 2a:1:1:split:2", hebrew: "ב", english: "b"},
    ],
    ...overrides,
  };
}

function mergeOverride(): SegmentationOverride {
  return {
    kind: "merge",
    level: "segment",
    refs: ["__Test_Book__ 2a:1", "__Test_Book__ 2a:2"],
  };
}

test("segmentationOverridesForPage returns undefined when there's no file", () => {
  expect(segmentationOverridesForPage(PAGE)).toBeUndefined();
});

test("addSegmentationOverride then segmentationOverridesForPage round-trips", () => {
  addSegmentationOverride(PAGE, splitOverride());
  expect(segmentationOverridesForPage(PAGE)).toEqual({overrides: [splitOverride()]});
});

test("addSegmentationOverride preserves overrides already on the page", () => {
  addSegmentationOverride(PAGE, splitOverride());
  addSegmentationOverride(PAGE, mergeOverride());
  expect(segmentationOverridesForPage(PAGE)).toEqual({
    overrides: [splitOverride(), mergeOverride()],
  });
});

test("supports the attachExistingCommentary flag on a split piece", () => {
  const override = splitOverride({
    pieces: [
      {
        ref: "Rashi on __Test_Book__ 2a:1:1:split:1",
        hebrew: "א",
        english: "a",
        attachExistingCommentary: true,
      },
      {ref: "Rashi on __Test_Book__ 2a:1:1:split:2", hebrew: "ב", english: "b"},
    ],
  });
  addSegmentationOverride(PAGE, override);
  expect(segmentationOverridesForPage(PAGE)).toEqual({overrides: [override]});
});
