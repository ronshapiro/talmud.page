import {books} from "./books";

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
    };
  }
  return {
    masechet: book,
    amudStart: pathParts[1],
    amudEnd: pathParts[3] || pathParts[1],
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
