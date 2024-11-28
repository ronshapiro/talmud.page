import {books} from "./books";
import {BIRKAT_HAMAZON_SECTIONS, SIDDUR_ASHKENAZ_SECTIONS, SIDDUR_SEFARD_SECTIONS} from "./siddur";

export const computePreviousAmud = (current: string): string => {
  const number = parseInt(current);
  return current.endsWith("b") ? number + "a" : (number - 1) + "b";
};

export const computeNextAmud = (current: string): string => {
  const number = parseInt(current);
  return current.endsWith("a") ? number + "b" : (number + 1) + "a";
};

const AMUD_REGEX = /^\d{1,3}[ab]$/;

interface AmudMetadata {
  masechet: string;
  isTalmud: boolean;
  amudStart?: string;
  amudEnd?: string;
  range: () => string[];
  documentTitleOverride?: string;
  databaseTitleOverride?: string;
}

function validAmudOrUndefined(amud: string | undefined): string | undefined {
  if (!amud) {
    return undefined;
  }
  return AMUD_REGEX.test(amud) ? amud : undefined;
}

const HARD_CODED_SECTIONS: Record<string, [string[], string]> = {
  SiddurAshkenaz: [SIDDUR_ASHKENAZ_SECTIONS, "Siddur - Ashkenaz"],
  SiddurSefard: [SIDDUR_SEFARD_SECTIONS, "Siddur - Sefard"],
  BirkatHamazon: [BIRKAT_HAMAZON_SECTIONS, "Birkat Hamazon"],
};

export function tryReadHardcodedSections(): string[] | undefined {
  const hardcoded = (document.getElementById("metaBookSections") as HTMLMetaElement)?.content;
  if (!hardcoded) return undefined;
  try {
    const asText = atob(hardcoded);
    return JSON.parse(asText) as string[];
  } catch (e: any) {
    console.error(e);
    return undefined;
  }
}

const _amudMetadata = (book: string, pathname: string): AmudMetadata => {
  if (book in HARD_CODED_SECTIONS) {
    const [sectionNames, title] = HARD_CODED_SECTIONS[book];
    const sections = sectionNames.map(x => x.replace(/ /g, "_"));
    return {
      masechet: book,
      isTalmud: false,
      amudStart: sections[0],
      amudEnd: sections.at(-1),
      range: () => sections,
      documentTitleOverride: title,
      databaseTitleOverride: "Siddur",
    };
  }

  const pathParts = pathname.split("/");
  pathParts.shift();

  if (books[book].isMasechet) {
    return {
      masechet: book,
      isTalmud: true,
      amudStart: validAmudOrUndefined(pathParts[1]),
      amudEnd: validAmudOrUndefined(pathParts[3] || pathParts[1]),
      range() {
        if (!this.amudStart) {
          return [];
        }
        if (!this.amudEnd) {
          return [this.amudStart];
        }

        let current = this.amudStart;
        const results = [current];
        while (current !== this.amudEnd) {
          current = computeNextAmud(current);
          results.push(current);
        }
        return results;
      },
    };
  }
  return {
    masechet: book,
    isTalmud: false,
    amudStart: pathParts[1],
    amudEnd: pathParts[3] || pathParts[1],
    range() {
      const hardcoded = tryReadHardcodedSections();
      if (!this.amudStart) {
        return [];
      }
      if (!this.amudEnd) {
        return [this.amudStart];
      }

      if (hardcoded) {
        const start = hardcoded.indexOf(this.amudStart);
        const end = hardcoded.indexOf(this.amudEnd);
        if (start === -1 || end === -1) {
          throw new Error(`Invalid section(s): ${start}, ${end}`);
        }
        return hardcoded.slice(start, end + 1);
      }

      const start = parseInt(this.amudStart);
      const end = parseInt(this.amudEnd);

      if (start >= end) {
        return [this.amudStart];
      }
      const results = [];
      for (let i = start; i <= end; i++) {
        results.push(i.toString());
      }
      return results;
    },
  };
};

interface AmudMetadataFunction {
  (): AmudMetadata;
}

export const amudMetadata: AmudMetadataFunction = () => {
  const metadata = _amudMetadata(
    (document.getElementById("book-title") as HTMLMetaElement)?.content,
    window.location.pathname);
  if (localStorage.restrictRange) {
    metadata.range = () => localStorage.restrictRange.replace(/ /g, '_').split(",");
  }
  return metadata;
};
export function amudMetadataForTesting(path: string): AmudMetadata {
  return _amudMetadata(path.split("/")[1], path);
}
