// https://www.quora.com/In-the-Hebrew-Bible-what-is-the-purpose-of-%D7%A1-or-%D7%A4-at-the-end-of-a-verse

export function isPehSectionEnding(value: string): boolean {
  return value.includes("mam-spi-pe");
}

export function transformTanakhSpacing(value: string): string {
  const samekhMatch = value.match(/(.*)(<span class="mam-spi-samekh">{ס}<\/span>)(\s+)(.*)/);
  if (samekhMatch) {
    return transformTanakhSpacing([
      samekhMatch[1], // the actual text
      '<span class="mam-spi-samekh">',
      samekhMatch[3].split("").map(() => "&nbsp;").join(""),
      '</span>',
      samekhMatch[4],
    ].join(""));
  }
  const pehMatch = value.match(/(.*)<span class="mam-spi-pe">{פ}<\/span>(<br>)?$/);
  if (pehMatch) {
    return pehMatch[1] + '<span class="mam-spi-pe"></span>';
  }

  return value;
  // TODO: maybe just replace multiple consecutive spaces with nbsp;?
}
