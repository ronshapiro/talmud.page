const TITLES_TO_BOLDIFY = new Set([
  "Rashi",
  "Rashbam",
  "Tosafot",
]);

const SPLITTERS = [
  "-",
  "–",
].map(x => ` ${x} `);

export function boldDibureiHamatchil(
  text: sefaria.TextType,
  commentaryName: string,
): sefaria.TextType {
  if (!TITLES_TO_BOLDIFY.has(commentaryName)) {
    return text;
  }

  if (Array.isArray(text)) {
    return text.map(x => boldDibureiHamatchil(x, commentaryName)) as sefaria.TextType;
  }

  for (const splitter of SPLITTERS) {
    const index = text.indexOf(splitter);
    if (index !== -1) {
      const diburHamatchil = text.substring(0, index);
      const comment = text.substring(index + splitter.length);
      return `<strong class="dibur-hamatchil">${diburHamatchil}</strong>${splitter}${comment}`;
    }
  }

  return text;
}
