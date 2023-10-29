// eslint-disable-next-line @typescript-eslint/triple-slash-reference,spaced-comment
/// <reference path="sefaria.d.ts" />

export function sefariaTextTypeTransformation(
  transformation: (text: string) => string,
): (text: sefaria.TextType) => sefaria.TextType {
  const recursive = (text: sefaria.TextType): sefaria.TextType => {
    if (Array.isArray(text)) {
      return text.map(recursive) as sefaria.TextType;
    }
    return transformation(text);
  };
  return recursive;
}

export function firstOrOnlyElement(text: sefaria.TextType): string {
  if (typeof text === "string") {
    return text;
  }
  return firstOrOnlyElement(text[0]);
}

export function equalJaggedArrays(hebrew: sefaria.TextType, english: sefaria.TextType): boolean {
  if (Array.isArray(hebrew) && Array.isArray(english)) {
    if (hebrew.length !== english.length) {
      return false;
    }
    for (let i = 0; i <= hebrew.length; i++) {
      if (!equalJaggedArrays(hebrew[i], english[i])) {
        return false;
      }
    }
    return true;
  }

  return hebrew === english;
}
