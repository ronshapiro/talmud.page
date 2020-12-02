export const computePreviousAmud = (current: string): string => {
  const number = parseInt(current);
  return current.endsWith("b") ? number + "a" : (number - 1) + "b";
};

export const computeNextAmud = (current: string): string => {
  const number = parseInt(current);
  return current.endsWith("a") ? number + "b" : (number + 1) + "a";
};

const SPACE_REGEX = /(%20|_)/g;

interface AmudMetadata {
  masechet: string;
  amudStart: string;
  amudEnd: string;
  range: () => string[];
}

const _amudMetadata = (pathname: string): AmudMetadata => {
  const pathParts = pathname.split("/");
  return {
    masechet: pathParts[1].replace(SPACE_REGEX, " "),
    amudStart: pathParts[2],
    amudEnd: pathParts[4] || pathParts[2],
    range() {
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
