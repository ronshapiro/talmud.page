import {HebrewSmallToEmphasisTagTranslator} from "../hebrew_small_to_emphasis";

test("small to emphasis", () => {
  expect(
    HebrewSmallToEmphasisTagTranslator.process(
      `it's a <small attr="ignored">world</small> after <i>all</i>`),
  ).toBe(`it's a <span class="hebrew-emphasis">world</span> after <i>all</i>`);
});
