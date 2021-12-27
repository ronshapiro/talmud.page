import {books} from "./books";
import {SIDDUR_SECTIONS} from "./siddur";

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
  amudStart?: string;
  amudEnd?: string;
  range: () => string[];
}

function validAmudOrUndefined(amud: string | undefined): string | undefined {
  if (!amud) {
    return undefined;
  }
  return AMUD_REGEX.test(amud) ? amud : undefined;
}

const _amudMetadata = (book: string, pathname: string): AmudMetadata => {
  const pathParts = pathname.split("/");
  pathParts.shift();

  if (books[book].isMasechet) {
    return {
      masechet: book,
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
    amudStart: pathParts[1],
    amudEnd: pathParts[3] || pathParts[1],
    range() {
      if (!this.amudStart) {
        return [];
      }
      if (!this.amudEnd) {
        return [this.amudStart];
      }

      if (book === "SiddurAshkenaz") {
        const siddurSectionsUrl = SIDDUR_SECTIONS.map(x => x.replace(/ /g, "_"));
        return siddurSectionsUrl.slice(
          siddurSectionsUrl.indexOf(this.amudStart),
          siddurSectionsUrl.indexOf(this.amudEnd) + 1);
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
  return _amudMetadata(
    (document.getElementById("book-title") as HTMLMetaElement)?.content,
    window.location.pathname);
};
export function amudMetadataForTesting(path: string): AmudMetadata {
  return _amudMetadata(path.split("/")[1], path);
}
