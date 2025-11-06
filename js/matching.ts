// eslint-disable-next-line no-misleading-character-class,unicorn/better-regex
const NON_SIGNIFICANT_CHARACTERS = /[,"'.?!:;\-–—=[\]()/ ֑-ׇ]*/.source;
const NON_SIGNIFICANT_CHARACTER = new RegExp(NON_SIGNIFICANT_CHARACTERS.replace("*", ""));

const ESCAPED_CHARS = new Set(["?", "(", ")"]);

function createRegex(input: string): RegExp | undefined {
  const asString = (
    input.split("")
      .map(x => {
        if (ESCAPED_CHARS.has(x)) {
          return `\\${x}?`;
        }
        return NON_SIGNIFICANT_CHARACTER.test(x) ? `${x}?` : x;
      })
      .join(NON_SIGNIFICANT_CHARACTERS)
  );
  try {
    return new RegExp(asString);
  } catch {
    console.error(`${asString} is not a valid regex`);
    return undefined;
  }
}

interface MatchResult {
  start: number;
  length: number;
}
export type Matcher = (argument: string) => MatchResult | undefined;

// export for testing only
export function createRegexMatcher(regexText: string): Matcher | undefined {
  const regex = createRegex(regexText);
  if (!regex) return undefined;
  return (argument: string) => {
    const match = argument.match(regex);
    if (!match) return undefined;
    return {
      start: match.index!,
      length: match[0].length,
    };
  };
}

export function createSimpleIterativeMatcher(regexText: string, start = 0): Matcher | undefined {
  if (regexText.length === 0) return undefined;
  return (argument: string) => {
    while (true) { // eslint-disable-line no-constant-condition
      start = argument.indexOf(regexText[0], start);
      if (start === -1) break;

      let regexIndex = 0;
      let length = 0;
      while (true) { // eslint-disable-line no-constant-condition
        if (regexIndex === regexText.length) {
          return {start, length};
        }
        const regexChar = regexText[regexIndex];
        const argumentChar = argument[start + length];
        if (regexChar === argumentChar) {
          regexIndex++;
          length++;
        } else if (NON_SIGNIFICANT_CHARACTER.test(argumentChar)) {
          length++;
        } else if (NON_SIGNIFICANT_CHARACTER.test(regexChar)) {
          regexIndex++;
        } else {
          break;
        }
      }

      start++;
    }
    return undefined;
  };
}
