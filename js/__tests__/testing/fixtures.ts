/**
 * Builders for the API/UI data shapes, so a test states only the fields it cares about.
 *
 * The texts are deliberately recognizable ASCII-ish markers rather than realistic Hebrew, so that
 * assertion failures are readable. Tests that specifically care about Hebrew (direction, hebrew-
 * only mode) pass their own.
 */
import {v4 as newUuid} from "uuid";
import {ApiComment, Commentary, CommentaryMap} from "../../../apiTypes";
import {UiPage} from "../../Page";
import {UiSegment} from "../../Segment";

let counter = 0;
function nextId(): number {
  counter++;
  return counter;
}

/** Resets the auto-generated ref counter, so refs are stable within a test. */
export function resetFixtureCounter(): void {
  counter = 0;
}

export function comment(overrides: Partial<ApiComment> = {}): ApiComment {
  const id = overrides.ref ?? `Comment ${nextId()}`;
  return {
    ref: id,
    he: `hebrew of ${id}`,
    en: `english of ${id}`,
    sourceRef: id,
    sourceHeRef: `he:${id}`,
    ...overrides,
  };
}

export function commentary(...comments: Partial<ApiComment>[]): Commentary {
  // Fully-specified comments pass through unchanged, since `comment()` spreads its argument last.
  return {comments: comments.map(x => comment(x))};
}

/**
 * Builds a commentary map from `{name: [comments]}`, e.g.
 * `commentaries({Rashi: [{he: "..."}], Tosafot: []})`.
 */
export function commentaries(
  source: Record<string, Partial<ApiComment>[]>,
): CommentaryMap {
  const result: CommentaryMap = {};
  for (const [name, comments] of Object.entries(source)) {
    result[name] = commentary(...comments);
  }
  return result;
}

export function segment(overrides: Partial<UiSegment> = {}): UiSegment {
  const ref = overrides.ref ?? `Berakhot 2a:${nextId()}`;
  return {
    ref,
    uuid: newUuid(),
    he: `hebrew of ${ref}`,
    en: `english of ${ref}`,
    sourceRef: "William Davidson Edition",
    sourceHeRef: "מהדורת ויליאם דוידסון",
    ...overrides,
  };
}

export function page(overrides: Partial<UiPage> = {}): UiPage {
  const id = overrides.id ?? "2a";
  return {
    id,
    title: `Berakhot ${id}`,
    titleHebrew: `ברכות ${id}`,
    sections: [segment(), segment()],
    ...overrides,
  };
}

/** A `page` whose sections are built from partial segment specs. */
export function pageWithSegments(
  id: string, ...sections: Partial<UiSegment>[]
): UiPage {
  return page({id, sections: sections.map(x => segment(x))});
}
