const TITLES_TO_BOLDIFY = new Set([
  "Rashi",
  "Rashbam",
  "Tosafot",
]);

const SPLITTERS = [
  "-",
  "–",
].map(x => ` ${x} `);

export function boldDibureiHamatchil(text: string, commentaryName: string): string {
  if (!TITLES_TO_BOLDIFY.has(commentaryName)) {
    return text;
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
