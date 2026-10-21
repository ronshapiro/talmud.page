import {refRange} from "../refs";

describe("refRange", () => {
  test("returns a single ref unchanged", () => {
    expect(refRange("Arakhin 8b:17", "Arakhin 8b:17")).toBe("Arakhin 8b:17");
  });

  test("collapses the end page when both ends are on the same amud", () => {
    expect(refRange("Arakhin 8b:15", "Arakhin 8b:16")).toBe("Arakhin 8b:15-16");
  });

  test("spans amudim", () => {
    expect(refRange("Arakhin 8b:17", "Arakhin 10a:1")).toBe("Arakhin 8b:17-10a:1");
  });

  test("takes the start of the first range and the end of the second", () => {
    expect(refRange("Rosh Hashanah 2a:1-3", "Rosh Hashanah 2b:4-3a:2"))
      .toBe("Rosh Hashanah 2a:1-3a:2");
    expect(refRange("Rosh Hashanah 2a:1-3", "Rosh Hashanah 2a:5-7")).toBe("Rosh Hashanah 2a:1-7");
  });
});
