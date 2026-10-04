// Off-screen measurement of text blocks.
//
// A block is rendered once, at its final width and with its final CSS, with every token wrapped in
// a <span data-t=i>. Reading the spans' rects gives the block's line boxes, from which pagination
// can be computed without further layout. See print/README.md ("Layout engine").

import {Token, renderTokens} from "../model/richText";

export interface BlockSpec {
  key: string;
  // CSS classes and inline style of the block element. Must match the final rendering exactly.
  className: string;
  style?: string;
  dir: "rtl" | "ltr";
  // Language, for hyphenation.
  lang?: string;
  // The text continues in another block (e.g. wrapped below): keep the last line justified.
  justifyEnd?: boolean;
  tokens: Token[];
  // HTML placed before the first token on the first fragment only (e.g. a commentator heading
  // run-in). It is measured as part of the first line.
  leadHtml?: string;
}

export interface LineBox {
  // First token on this line.
  start: number;
  // Distance from the top of the block to the bottom of this line box.
  bottom: number;
}

export interface MeasuredBlock {
  spec: BlockSpec;
  width: number;
  height: number;
  lines: LineBox[];
  // Distance from the top of the block to the first line's baseline.
  baseline: number;
}

let measurementRoot: HTMLElement | undefined;

/**
 * The measurement root lives inside an element carrying the same "context" classes as the real
 * pages (e.g. `print-root siddur`), so that descendant CSS selectors apply identically.
 */
export function setMeasurementContext(contextClassName: string, contextStyle = ""): HTMLElement {
  if (!measurementRoot) {
    measurementRoot = document.createElement("div");
    measurementRoot.setAttribute("aria-hidden", "true");
    document.body.append(measurementRoot);
  }
  measurementRoot.className = `${contextClassName} measurement-root`;
  measurementRoot.setAttribute("style", [
    "position: absolute",
    "left: -100000px",
    "top: 0",
    "visibility: hidden",
    "contain: layout style",
    contextStyle,
  ].join("; "));
  measurementRoot.innerHTML = "";
  return measurementRoot;
}

function root(): HTMLElement {
  if (!measurementRoot) throw new Error("setMeasurementContext() must be called first");
  return measurementRoot;
}

/**
 * HTML for tokens [start, end). With `justifyFrom`, the tokens from there on (a fragment's last
 * line, when the paragraph continues in the next column) are wrapped in a block that keeps that
 * line justified; `text-align-last` on the whole block would also stretch lines before <br>s.
 */
export function blockInnerHtml(
  spec: BlockSpec,
  start: number,
  end: number,
  wrap: boolean,
  justifyFrom?: number,
): string {
  const lead = start === 0 && spec.leadHtml ? spec.leadHtml : "";
  const tokens = justifyFrom === undefined
    ? spec.tokens
    : spec.tokens.map((token, i) => (i >= justifyFrom && i < end
      ? {...token, marks: [{tag: "span", attrs: ' class="last-line"'}, ...token.marks]}
      : token));
  return lead + renderTokens(tokens, {
    start,
    end,
    wrapWord: wrap ? (html, i) => `<span data-t="${i}">${html}</span>` : undefined,
  });
}

const cache = new Map<string, MeasuredBlock>();

function hashString(text: string): string {
  // Polynomial rolling hash; a collision only costs a stale measurement within a session.
  let hash = 7;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) % 2147483647;
  }
  return `${text.length}.${hash.toString(36)}`;
}

function cacheKey(spec: BlockSpec, width: number): string {
  const content = hashString(blockInnerHtml(spec, 0, spec.tokens.length, false));
  return `${spec.key}@${width.toFixed(2)}|${spec.className}|${spec.style ?? ""}|${spec.dir}|${content}`;
}

export function clearMeasurementCache(): void {
  cache.clear();
}

interface RawLine {
  start: number;
  top: number;
  bottom: number;
}

const BASELINE_PROBE = '<span class="baseline-probe" '
  + 'style="display: inline-block; width: 0; height: 0; vertical-align: baseline"></span>';

function readLines(spec: BlockSpec, element: HTMLElement, width: number): MeasuredBlock {
  const blockRect = element.getBoundingClientRect();
  const {height} = blockRect;
  const probe = element.querySelector(".baseline-probe");
  const baseline = probe ? probe.getBoundingClientRect().top - blockRect.top : 0;
  const spans = element.querySelectorAll<HTMLElement>("span[data-t]");
  const lines: RawLine[] = [];
  let current: RawLine | undefined;
  spans.forEach(span => {
    const index = parseInt(span.dataset.t!);
    const rects = span.getClientRects();
    if (rects.length === 0) return;
    const top = rects[0].top - blockRect.top;
    const bottom = rects[rects.length - 1].bottom - blockRect.top;
    if (!current || top >= current.bottom - 1) {
      current = {start: index, top, bottom};
      lines.push(current);
    } else {
      current.top = Math.min(current.top, top);
      current.bottom = Math.max(current.bottom, bottom);
    }
  });

  if (lines.length === 0) {
    return {spec, width, height, baseline, lines: [{start: 0, bottom: height}]};
  }

  lines[0].start = 0;
  const boxes: LineBox[] = lines.map((line, i) => ({
    start: line.start,
    bottom: i === lines.length - 1
      ? height
      // The boundary between two line boxes lies midway between the glyph boxes. For uniform text
      // this is exactly the line-box boundary.
      : (line.bottom + lines[i + 1].top) / 2,
  }));
  return {spec, width, height, baseline, lines: boxes};
}

/** Measures many blocks at the given width with a single forced layout. */
export function measureBlocks(specs: BlockSpec[], width: number): MeasuredBlock[] {
  const results: (MeasuredBlock | undefined)[] = specs.map(x => cache.get(cacheKey(x, width)));
  const todo = specs.map((x, i) => i).filter(i => results[i] === undefined);
  if (todo.length === 0) return results as MeasuredBlock[];

  const container = document.createElement("div");
  container.style.width = `${width}px`;
  const elements: HTMLElement[] = [];
  for (const i of todo) {
    const spec = specs[i];
    const element = document.createElement("div");
    element.className = spec.className;
    if (spec.style) element.setAttribute("style", spec.style);
    element.dir = spec.dir;
    if (spec.lang) element.lang = spec.lang;
    // display: flow-root so that margins of children can't collapse through the block.
    element.style.display = "flow-root";
    // A zero-size inline-block sits on the baseline without affecting the line box.
    element.innerHTML = BASELINE_PROBE + blockInnerHtml(spec, 0, spec.tokens.length, true);
    // Before a block-level child the probe would create a line of its own: move it inside.
    const firstLine = element.querySelector(".sd-line");
    const probe = element.querySelector(".baseline-probe");
    if (firstLine && probe) firstLine.prepend(probe);
    container.append(element);
    elements.push(element);
  }
  root().append(container);

  todo.forEach((specIndex, n) => {
    const spec = specs[specIndex];
    const element = elements[n];
    const measured = readLines(spec, element, width);
    cache.set(cacheKey(spec, width), measured);
    results[specIndex] = measured;
  });

  container.remove();
  return results as MeasuredBlock[];
}

export function measureBlock(spec: BlockSpec, width: number): MeasuredBlock {
  return measureBlocks([spec], width)[0];
}

/** Measures an arbitrary HTML snippet's height at the given width (e.g. a page header). */
export function measureHtmlHeight(html: string, className: string, width: number, style = ""): number {
  const element = document.createElement("div");
  element.className = className;
  element.setAttribute("style", `${style}; width: ${width}px; display: flow-root`);
  element.innerHTML = html;
  root().append(element);
  const {height} = element.getBoundingClientRect();
  element.remove();
  return height;
}
