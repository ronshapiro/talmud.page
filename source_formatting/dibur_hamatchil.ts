const TITLES_TO_BOLDIFY = new Set([
  "Ran",
  "Rashi",
  "Rashbam",
  "Tosafot",
  "Mishnah Berurah",
]);

const SPLITTERS = [
  "-",
  "–",
].map(x => ` ${x} `);

function format(diburHamatchil: string, splitter: string, comment: string) {
  return `<strong class="dibur-hamatchil">${diburHamatchil}</strong>${splitter}${comment}`;
}

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
      return format(diburHamatchil, splitter, comment);
    }
  }

  if (commentaryName === "Tosafot" && text.includes(". ")) {
    const firstPeriod = text.indexOf(". ");
    const diburHamatchil = text.substring(0, firstPeriod);
    // Only match a period it's in the beginning of the text. As a simple heuristic, use the first
    // 20 words of the comment.
    if (diburHamatchil.split(" ").length <= 20) {
      return format(diburHamatchil, " - ", text.substring(firstPeriod + 2));
    }
  }

  return text;
}
