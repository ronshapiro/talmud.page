// Rich text as a flat list of word tokens.
//
// Sefaria/talmud.page text is HTML with a small vocabulary of inline elements (<b>, <i>, <small>,
// <big>, <span class=…>, <sup>, <br>). For print layout we need to:
//   - split a paragraph at an arbitrary word (to continue it in the next column/page),
//   - address individual words (forced line breaks, segment splits, inline style ranges).
// Both are easy if the text is a list of words where each word knows which inline elements
// ("marks") enclose it. This module converts HTML <-> tokens. It is deliberately DOM-free so it
// runs identically in the browser, in node, and in jest.

export interface Mark {
  tag: string;
  // Raw attribute string, e.g. ` class="foo" style="color: red"`. Kept verbatim so that the output
  // HTML is exactly as safe as the input (inputs are sanitized upstream).
  attrs: string;
}

export interface Token {
  kind: "word" | "br";
  // Escaped HTML text of the word (entities preserved as-is).
  html: string;
  // Enclosing inline elements, outermost first.
  marks: Mark[];
  // Whether whitespace follows this token in the source.
  spaceAfter: boolean;
}

const VOID_TAGS = new Set(["br", "img", "hr", "wbr"]);
// Elements whose content we never want in print output.
const DROPPED_TAGS = new Set(["script", "style", "img"]);
const BLOCK_TAGS = new Set(["p", "div", "li", "ul", "ol", "blockquote", "h1", "h2", "h3", "h4"]);

const TAG_RE = /<\/?([A-Za-z][\dA-Za-z]*)((?:\s+[^\s"'/=>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<=>`]+))?)*)\s*\/?>/g;
const WHITESPACE_RE = /\s/;

function markKey(mark: Mark): string {
  return `${mark.tag}${mark.attrs}`;
}

function sameMarks(a: Mark[], b: Mark[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i] && markKey(a[i]) !== markKey(b[i])) return false;
  }
  return true;
}

export function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const stack: Mark[] = [];
  let droppedDepth = 0;
  let currentWord = "";
  let currentMarks: Mark[] = [];

  const flushWord = (spaceAfter: boolean) => {
    if (currentWord.length > 0) {
      tokens.push({kind: "word", html: currentWord, marks: currentMarks, spaceAfter});
      currentWord = "";
    } else if (spaceAfter && tokens.length > 0) {
      tokens[tokens.length - 1].spaceAfter = true;
    }
  };

  const appendText = (text: string) => {
    if (droppedDepth > 0) return;
    for (const char of text) {
      if (WHITESPACE_RE.test(char)) {
        flushWord(true);
      } else {
        if (currentWord.length === 0) {
          currentMarks = stack.slice();
        } else if (!sameMarks(currentMarks, stack)) {
          // A mark boundary within a word (e.g. <b>בְּ</b>רֵאשִׁית). Keep it one token but split it
          // into a sub-token with no space between; this preserves the inline markup exactly.
          tokens.push({kind: "word", html: currentWord, marks: currentMarks, spaceAfter: false});
          currentWord = "";
          currentMarks = stack.slice();
        }
        currentWord += char;
      }
    }
  };

  let lastIndex = 0;
  TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((match = TAG_RE.exec(html)) !== null) {
    appendText(html.slice(lastIndex, match.index));
    lastIndex = TAG_RE.lastIndex;

    const isEnd = match[0].startsWith("</");
    const tag = match[1].toLowerCase();
    const attrs = match[2] ?? "";

    if (DROPPED_TAGS.has(tag)) {
      if (!VOID_TAGS.has(tag)) droppedDepth += isEnd ? -1 : 1;
      continue;
    }
    if (droppedDepth > 0) continue;

    if (tag === "br") {
      flushWord(false);
      tokens.push({kind: "br", html: "<br>", marks: stack.slice(), spaceAfter: false});
      continue;
    }
    if (VOID_TAGS.has(tag)) continue;

    if (BLOCK_TAGS.has(tag)) {
      // Treat block boundaries as whitespace; print blocks are built by the layout engine.
      flushWord(true);
      continue;
    }

    if (isEnd) {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].tag === tag) {
          stack.splice(i, 1);
          break;
        }
      }
    } else {
      stack.push({tag, attrs});
    }
  }
  appendText(html.slice(lastIndex));
  flushWord(false);

  return tokens;
}

/**
 * Indices of tokens that begin a word, i.e. positions where a line break could occur. A word may
 * span multiple tokens when markup changes mid-word.
 */
export function wordStarts(tokens: Token[]): number[] {
  const starts: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (i === 0 || tokens[i - 1].spaceAfter || tokens[i - 1].kind === "br" || tokens[i].kind === "br") {
      starts.push(i);
    }
  }
  return starts;
}

/** Plain text of a token range (tags stripped, entities left as-is). */
export function tokensText(tokens: Token[], start = 0, end = tokens.length): string {
  let text = "";
  for (let i = start; i < end; i++) {
    const token = tokens[i];
    if (token.kind === "br") {
      text += "\n";
    } else {
      text += token.html;
      if (token.spaceAfter && i < end - 1) text += " ";
    }
  }
  return text;
}

export interface RenderOptions {
  start?: number;
  end?: number;
  // Wrap each token's HTML (e.g. in a measurement span). `index` is the absolute token index.
  wrapWord?: (html: string, index: number) => string;
}

export function renderTokens(tokens: Token[], options: RenderOptions = {}): string {
  const start = options.start ?? 0;
  const end = Math.min(options.end ?? tokens.length, tokens.length);
  const out: string[] = [];
  let open: Mark[] = [];

  const transitionTo = (marks: Mark[]) => {
    let common = 0;
    while (common < open.length
      && common < marks.length
      && markKey(open[common]) === markKey(marks[common])) {
      common++;
    }
    for (let i = open.length - 1; i >= common; i--) out.push(`</${open[i].tag}>`);
    for (let i = common; i < marks.length; i++) out.push(`<${marks[i].tag}${marks[i].attrs}>`);
    open = marks;
  };

  for (let i = start; i < end; i++) {
    const token = tokens[i];
    if (i > start && tokens[i - 1].spaceAfter && tokens[i - 1].kind !== "br" && token.kind !== "br") {
      // Emit the space in the context shared by both neighbors.
      const shared: Mark[] = [];
      for (let m = 0; m < open.length && m < token.marks.length; m++) {
        if (markKey(open[m]) !== markKey(token.marks[m])) break;
        shared.push(open[m]);
      }
      transitionTo(shared);
      out.push(" ");
    }
    transitionTo(token.marks);
    if (token.kind === "br") {
      out.push("<br>");
    } else {
      out.push(options.wrapWord ? options.wrapWord(token.html, i) : token.html);
    }
  }
  transitionTo([]);
  return out.join("");
}

export function renderHtml(html: string): string {
  return renderTokens(tokenize(html));
}

// ---------------------------------------------------------------------------------------------
// Transformations used by the editors.

export interface InlineStyle {
  bold?: boolean;
  italic?: boolean;
  // Multiplier on the surrounding font size, e.g. 1.3.
  scale?: number;
  color?: string;
  letterSpacing?: number; // em
  smallCaps?: boolean;
  // Free-form CSS appended verbatim (validated by `sanitizeCss`).
  css?: string;
  className?: string;
}

export interface StyleRange {
  start: number; // token index, inclusive
  end: number; // token index, exclusive
  style: InlineStyle;
}

const SAFE_CSS_PROPERTY = /^-?[a-z][a-z-]*$/;
const UNSAFE_CSS_VALUE = /(url\s*\(|expression\s*\(|javascript:|[<>{}]|\\)/i;

/**
 * Allow simple `prop: value;` declarations only. Drops anything that could escape the attribute.
 */
export function sanitizeCss(css: string): string {
  return css
    .split(";")
    .map(x => x.trim())
    .filter(x => x.length > 0)
    .map(declaration => {
      const colon = declaration.indexOf(":");
      if (colon === -1) return undefined;
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration.slice(colon + 1).trim();
      if (!SAFE_CSS_PROPERTY.test(property) || UNSAFE_CSS_VALUE.test(value) || value.includes('"')) {
        return undefined;
      }
      return `${property}: ${value}`;
    })
    .filter(x => x !== undefined)
    .join("; ");
}

export function inlineStyleCss(style: InlineStyle): string {
  const parts: string[] = [];
  if (style.bold !== undefined) parts.push(`font-weight: ${style.bold ? "bold" : "normal"}`);
  if (style.italic !== undefined) parts.push(`font-style: ${style.italic ? "italic" : "normal"}`);
  if (style.scale !== undefined) parts.push(`font-size: ${Math.round(style.scale * 1000) / 1000}em`);
  if (style.color) parts.push(`color: ${style.color}`);
  if (style.letterSpacing !== undefined) parts.push(`letter-spacing: ${style.letterSpacing}em`);
  if (style.smallCaps) parts.push("font-variant: small-caps");
  const css = parts.join("; ");
  const extra = style.css ? sanitizeCss(style.css) : "";
  return [css, extra].filter(x => x.length > 0).join("; ");
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function styleMark(style: InlineStyle): Mark {
  const css = inlineStyleCss(style);
  const classes = ["ps-style", style.className].filter(x => x).join(" ");
  return {
    tag: "span",
    attrs: ` class="${escapeAttribute(classes)}"${css ? ` style="${escapeAttribute(css)}"` : ""}`,
  };
}

/** Returns new tokens with each style range applied as an innermost span mark. */
export function applyStyleRanges(tokens: Token[], ranges: StyleRange[]): Token[] {
  if (ranges.length === 0) return tokens;
  const result = tokens.map(x => ({...x}));
  for (const range of ranges) {
    const mark = styleMark(range.style);
    for (let i = Math.max(0, range.start); i < Math.min(range.end, result.length); i++) {
      result[i] = {...result[i], marks: [...result[i].marks, mark]};
    }
  }
  return result;
}

/** Inserts forced line breaks *before* the given token indices. */
export function applyLineBreaks(tokens: Token[], breakBefore: number[]): Token[] {
  if (breakBefore.length === 0) return tokens;
  const breaks = new Set(breakBefore.filter(x => x > 0 && x < tokens.length));
  const result: Token[] = [];
  tokens.forEach((token, i) => {
    if (breaks.has(i)) {
      if (result.length > 0) {
        result[result.length - 1] = {...result[result.length - 1], spaceAfter: false};
      }
      result.push({kind: "br", html: "<br>", marks: [], spaceAfter: false});
    }
    result.push(token);
  });
  return result;
}

function trimBreaks(tokens: Token[]): Token[] {
  let start = 0;
  let end = tokens.length;
  while (start < end && tokens[start].kind === "br") start++;
  while (end > start && tokens[end - 1].kind === "br") end--;
  const result = tokens.slice(start, end);
  if (result.length > 0) {
    result[result.length - 1] = {...result[result.length - 1], spaceAfter: false};
  }
  return result;
}

/** Splits tokens into consecutive slices starting at each of `splitPoints` (token indices). */
export function splitTokens(tokens: Token[], splitPoints: number[]): Token[][] {
  const points = Array.from(new Set(splitPoints))
    .filter(x => x > 0 && x < tokens.length)
    .sort((a, b) => a - b);
  const pieces: Token[][] = [];
  let last = 0;
  for (const point of points) {
    pieces.push(trimBreaks(tokens.slice(last, point)));
    last = point;
  }
  pieces.push(trimBreaks(tokens.slice(last)));
  return pieces;
}

/**
 * Slices tokens at the given (sorted, possibly repeated) points, always returning
 * `points.length + 1` slices so that parallel texts stay aligned. Slices may be empty.
 */
export function sliceTokens(tokens: Token[], points: number[]): Token[][] {
  const bounds = [0, ...points.map(x => Math.max(0, Math.min(tokens.length, x))), tokens.length];
  const slices: Token[][] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    slices.push(trimBreaks(tokens.slice(bounds[i], Math.max(bounds[i], bounds[i + 1]))));
  }
  return slices;
}

/** Concatenates token lists with a space (or a line break) between them. */
export function joinTokens(lists: Token[][], separator: "space" | "br" = "space"): Token[] {
  const result: Token[] = [];
  for (const list of lists) {
    if (list.length === 0) continue;
    if (result.length > 0) {
      if (separator === "br") {
        result.push({kind: "br", html: "<br>", marks: [], spaceAfter: false});
      } else {
        result[result.length - 1] = {...result[result.length - 1], spaceAfter: true};
      }
    }
    result.push(...list);
  }
  return result;
}

/** Wraps all tokens in an additional outermost mark. */
export function wrapTokens(tokens: Token[], mark: Mark): Token[] {
  return tokens.map(x => ({...x, marks: [mark, ...x.marks]}));
}

export function textToken(html: string, marks: Mark[] = [], spaceAfter = true): Token {
  return {kind: "word", html, marks, spaceAfter};
}
