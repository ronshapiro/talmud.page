const {
  amudMetadataForTesting,
  computePreviousAmud,
  computeNextAmud,
} = require("./amud.js");

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
      const actual = amudMetadata("/Bava_Batra/2a");
      expect(actual.masechet).toBe("Bava Batra");
      expect(actual.amudStart).toBe("2a");
      expect(actual.amudEnd).toBe("2a");
      expect(actual.range()).toEqual(["2a"]);
    });

    test("amud range", () => {
      const actual = amudMetadata("/Bava_Batra/2a/to/3b");
      expect(actual.masechet).toBe("Bava Batra");
      expect(actual.amudStart).toBe("2a");
      expect(actual.amudEnd).toBe("3b");
      expect(actual.range()).toEqual(["2a", "2b", "3a", "3b"]);
    });
  });

  describe("multiple word with url-escaped spacesmasechet", () => {
    test("single amud", () => {
      const actual = amudMetadata("/Bava%20Batra/2a");
      expect(actual.masechet).toBe("Bava Batra");
      expect(actual.amudStart).toBe("2a");
      expect(actual.amudEnd).toBe("2a");
      expect(actual.range()).toEqual(["2a"]);
    });

    test("amud range", () => {
      const actual = amudMetadata("/Bava%20Batra/2a/to/3b");
      expect(actual.masechet).toBe("Bava Batra");
      expect(actual.amudStart).toBe("2a");
      expect(actual.amudEnd).toBe("3b");
      expect(actual.range()).toEqual(["2a", "2b", "3a", "3b"]);
    });
  });
});
