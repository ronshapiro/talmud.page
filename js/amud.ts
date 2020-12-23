export const computePreviousAmud = (current: string): string => {
  const number = parseInt(current);
  return current.endsWith("b") ? number + "a" : (number - 1) + "b";
};

export const computeNextAmud = (current: string): string => {
  const number = parseInt(current);
  return current.endsWith("a") ? number + "b" : (number + 1) + "a";
};

const SPACE_REGEX = /(%20|_)/g;
const AMUD_REGEX = /^[0-9]{1,3}[ab]$/;

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
  return {
    masechet: pathParts[1].replace(SPACE_REGEX, " "),
    amudStart: validAmudOrUndefined(pathParts[2]),
    amudEnd: validAmudOrUndefined(pathParts[4] || pathParts[2]),
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
};

interface AmudMetadataFunction {
  (): AmudMetadata;
}

export const amudMetadata: AmudMetadataFunction = () => _amudMetadata(window.location.pathname);
export const amudMetadataForTesting = _amudMetadata;
