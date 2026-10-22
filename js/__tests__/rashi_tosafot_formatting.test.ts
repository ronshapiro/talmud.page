import {
  expandAbbreviations,
  stripExplanations,
  formatRashiTosafotHebrew,
  stripAbbreviationMarkup,
  stripAddedPunctuation,
} from "../rashi_tosafot_formatting";

describe("rashi_tosafot_formatting", () => {
  describe("stripExplanations", () => {
    test("extracts single explanation span and cleans Hebrew text", () => {
      const input = "מתני׳ כ״א תקיעות, <span class=\"explanation\">הגמרא</span> מפרש להו:";
      const result = stripExplanations(input);
      expect(result).toBe("מתני׳ כ״א תקיעות, מפרש להו:");
    });

    test("extracts multiple explanation spans", () => {
      const input = "רש״י <span class=\"explanation\">פירש</span> אמר <span class=\"explanation\">רבו</span> סוף.";
      const result = stripExplanations(input);
      expect(result).toBe("רש״י אמר סוף.");
    });

    test("returns empty explanations when none present", () => {
      const input = "שלום עליכם חברים.";
      const result = stripExplanations(input);
      expect(result).toBe("שלום עליכם חברים.");
    });
  });

  describe("expandAbbreviations", () => {
    test("expands abbreviation into expanded-abbr tag", () => {
      const input = "<abbr title=\"מתניתין\">מתני׳</abbr>";
      const result = expandAbbreviations(input);
      expect(result).toBe("<abbr title=\"מתני׳\" class=\"expanded-abbr\">מתניתין</abbr>");
    });

    test("handles text without abbreviations", () => {
      const input = "טקסט רגיל ללא קיצורים";
      expect(expandAbbreviations(input)).toBe(input);
    });
  });

  describe("stripAbbreviationMarkup", () => {
    test("unwraps abbr tags to original inner abbreviation", () => {
      const input = "<abbr title=\"עשרים ואחת\">כ״א</abbr> תקיעות";
      expect(stripAbbreviationMarkup(input)).toBe("כ״א תקיעות");
    });
  });

  describe("stripAddedPunctuation", () => {
    test("removes commas, colons, and periods while preserving dibur hamatchil", () => {
      const input = "<b>מתני׳</b>: כ״א תקיעות, מפרש להו בפ׳ החליל.";
      expect(stripAddedPunctuation(input)).toBe("<b>מתני׳</b> כ״א תקיעות מפרש להו בפ׳ החליל");
    });
  });

  describe("formatRashiTosafotHebrew", () => {
    const rawWithMarkup = "<b>מתני׳</b>: <abbr title=\"עשרים ואחת\">כ״א</abbr> תקיעות, "
      + "<span class=\"explanation\">הגמרא</span> מפרש להו.";

    test("formats as punctuated-only (default) without inline explanations", () => {
      const result = formatRashiTosafotHebrew({
        rawHebrew: rawWithMarkup,
        option: "punctuated-only",
      });
      expect(result).toBe(
        "<b>מתני׳</b>: <abbr title=\"עשרים ואחת\">כ״א</abbr> תקיעות, מפרש להו.",
      );
    });

    test("formats as punctuated-expanded with expanded abbreviations", () => {
      const result = formatRashiTosafotHebrew({
        rawHebrew: rawWithMarkup,
        option: "punctuated-expanded",
      });
      expect(result).toBe(
        "<b>מתני׳</b>: <abbr title=\"כ״א\" class=\"expanded-abbr\">עשרים ואחת</abbr> תקיעות, מפרש להו.",
      );
    });

    test("formats as vilna using originalHebrew when provided", () => {
      const originalVilna = "מתני' כ\"א תקיעות מפרש להו";
      const result = formatRashiTosafotHebrew({
        rawHebrew: rawWithMarkup,
        originalHebrew: originalVilna,
        option: "vilna",
      });
      expect(result).toBe(originalVilna);
    });

    test("formats as vilna by stripping added punctuation and markup when originalHebrew is absent", () => {
      const result = formatRashiTosafotHebrew({
        rawHebrew: rawWithMarkup,
        option: "vilna",
      });
      expect(result).toBe("<b>מתני׳</b> כ״א תקיעות מפרש להו");
    });
  });
});
