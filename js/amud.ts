import {books} from "./books";

export const computePreviousAmud = (current: string): string => {
  const number = parseInt(current);
  return current.endsWith("b") ? number + "a" : (number - 1) + "b";
};

export const computeNextAmud = (current: string): string => {
  const number = parseInt(current);
  return current.endsWith("a") ? number + "b" : (number + 1) + "a";
};

const SPACE_REGEX = /(%20|_)/g;
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

const _amudMetadata = (pathname: string): AmudMetadata => {
  const pathParts = pathname.split("/");
  pathParts.shift();

  const book = pathParts[0].replace(SPACE_REGEX, " ");
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

export const amudMetadata: AmudMetadataFunction = () => _amudMetadata(window.location.pathname);
export const amudMetadataForTesting = _amudMetadata;
