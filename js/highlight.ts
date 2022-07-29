import {preOrderTraversal, isTextNode} from "./dom";
import {HighlightCommentWithText} from "./google_drive/types";

type HighlightingStyle = "email" | undefined;

function injectHighlighting(
  root: Node,
  start: number,
  end: number,
  highlight: HighlightCommentWithText,
  highlightingStyle: HighlightingStyle,
): void {
  let currentIndex = 0;
  preOrderTraversal(root).slice(1).forEach(child => {
    if (isTextNode(child)) {
      let highlightedStart = start - currentIndex;
      let highlightedEnd = end - currentIndex;
      if (child.data.charAt(highlightedStart) === " ") {
        highlightedStart += 1;
      }
      if (child.data.charAt(highlightedEnd - 1) === " ") {
        highlightedEnd -= 1;
      }
      if (currentIndex + child.data.length >= start && currentIndex <= end) {
        const before = document.createTextNode(child.data.substring(0, highlightedStart));
        const after = document.createTextNode(child.data.substring(highlightedEnd));
        const highlighted = document.createElement("span");
        // TODO: extract color from highlight range and set that here
        if (highlightingStyle === "email") {
          // @ts-ignore
          highlighted.style = "background: rgb(255, 201, 135)";
        } else {
          highlighted.className = `highlighted highlighted-${highlight.highlight}`;
        }
        highlighted.textContent = child.data.substring(highlightedStart, highlightedEnd);

        if (highlight.id) {
          highlighted.setAttribute("highlight-id", highlight.id);
        }

        const parent = child.parentNode!;
        parent.replaceChild(after, child);
        parent.insertBefore(highlighted, after);
        parent.insertBefore(before, highlighted);
      }
      currentIndex += child.data.length;
    }
  });
}

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

function percentageStrategy(
  highlight: HighlightCommentWithText,
  input: string,
): [number, number] {
  const {startPercentage, endPercentage} = highlight.commentSourceMetadata;
  return [
    Math.floor(startPercentage * input.length),
    Math.ceil(endPercentage * input.length),
  ];
}

function wordCountStrategy(
  highlight: HighlightCommentWithText,
  input: string,
): [number, number] {
  const {wordCountStart, wordCountEnd} = highlight.commentSourceMetadata;
  const parts = input.split(" ");
  let startCount = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i < wordCountStart) {
      startCount += part.length;
      startCount += 1; // length of the space
    }
  }
  let endCount = input.length;
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (i > wordCountEnd) {
      endCount -= part.length;
      endCount -= 1; // length of the space
    }
  }
  return [startCount, endCount];
}

function entireStringStrategy(
  highlight: HighlightCommentWithText,
  input: string,
): [number, number] {
  return [0, input.length];
}

const STRATEGIES: ((
  highlight: HighlightCommentWithText,
  input: string,
) => [number, number])[] = [
  percentageStrategy,
  wordCountStrategy,
  entireStringStrategy,
];

export function applyHighlight(
  highlight: HighlightCommentWithText,
  inputText: string | string[],
  highlightingStyle: HighlightingStyle = undefined,
): string | undefined {
  if (Array.isArray(inputText)) {
    // TODO: devise a strategy for multiline highlights
    return undefined;
  }
  const el = document.createElement("div");
  el.innerHTML = inputText;
  const justText = el.textContent;
  if (!justText) {
    console.error("text content is undefined!");
    return undefined;
  }

  const searchRegex = createRegex(highlight.text);
  if (!searchRegex) {
    return undefined;
  }
  for (const strategy of STRATEGIES) {
    const [start, end] = strategy(highlight, justText);
    const match = justText.substring(start, end).match(searchRegex);
    if (match && match.index !== undefined) {
      const matchStart = start + match.index;
      injectHighlighting(
        el, matchStart, matchStart + match[0].length, highlight, highlightingStyle);
      return el.innerHTML;
    }
  }

  return undefined;
}
