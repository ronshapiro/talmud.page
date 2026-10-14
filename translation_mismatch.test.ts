import {filterNonEnglishOverflow} from "./translation_mismatch";

describe("filterNonEnglishOverflow", () => {
  it("removes extra segments with non-English Latin characters", () => {
    const result = filterNonEnglishOverflow(["a"], ["one", "¿Qué?", "Voilà ça"]);
    expect(result.english).toEqual(["one"]);
    expect(result.removed).toEqual(["¿Qué?", "Voilà ça"]);
  });

  it("does nothing if any extra segment looks English", () => {
    const english = ["one", "café", "plain english"];
    const result = filterNonEnglishOverflow(["a"], english);
    expect(result.english).toEqual(english);
    expect(result.removed).toEqual([]);
  });

  it("does nothing when lengths are not overflowing", () => {
    expect(filterNonEnglishOverflow(["a", "b"], ["ñ"]).removed).toEqual([]);
  });
});
