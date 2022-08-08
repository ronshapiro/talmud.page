/*
import {
  amudMetadataForTesting,
  computePreviousAmud,
  computeNextAmud,
} from "../amud";

const amudMetadata = amudMetadataForTesting;

describe("computeNextAmud", () => {
  test("a -> b", () => {
    expect(computeNextAmud("2a")).toBe("2b");
  });

  test("b -> a", () => {
    expect(computeNextAmud("9b")).toBe("10a");
  });
});

describe("computePreviousAmud", () => {
  test("a -> b", () => {
    expect(computePreviousAmud("10a")).toBe("9b");
  });

  test("b -> a", () => {
    expect(computePreviousAmud("9b")).toBe("9a");
  });
});

describe("amudMetadata", () => {
  describe("single word masechet", () => {
    test("single amud", () => {
      const actual = amudMetadata("/Shabbat/2a");
      expect(actual.masechet).toBe("Shabbat");
      expect(actual.amudStart).toBe("2a");
      expect(actual.amudEnd).toBe("2a");
      expect(actual.range()).toEqual(["2a"]);
    });

    test("amud range", () => {
      const actual = amudMetadata("/Shabbat/2a/to/3b");
      expect(actual.masechet).toBe("Shabbat");
      expect(actual.amudStart).toBe("2a");
      expect(actual.amudEnd).toBe("3b");
      expect(actual.range()).toEqual(["2a", "2b", "3a", "3b"]);
    });
  });

  describe("multiple word masechet", () => {
    test("single amud", () => {
      const actual = amudMetadata("/Bava Batra/2a");
      expect(actual.masechet).toBe("Bava Batra");
      expect(actual.amudStart).toBe("2a");
      expect(actual.amudEnd).toBe("2a");
      expect(actual.range()).toEqual(["2a"]);
    });

    test("amud range", () => {
      const actual = amudMetadata("/Bava Batra/2a/to/3b");
      expect(actual.masechet).toBe("Bava Batra");
      expect(actual.amudStart).toBe("2a");
      expect(actual.amudEnd).toBe("3b");
      expect(actual.range()).toEqual(["2a", "2b", "3a", "3b"]);
    });
  });

  test("no amud", () => {
    const actual = amudMetadata("/Shabbat/notes");
    expect(actual.masechet).toBe("Shabbat");
    expect(actual.amudStart).toBeUndefined();
    expect(actual.amudEnd).toBeUndefined();
    expect(actual.range()).toEqual([]);
  });
});
*/ // DO NOT SUBMIT
