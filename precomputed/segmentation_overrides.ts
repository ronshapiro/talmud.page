import * as fs from "fs";
import {readUtf8} from "../files";
import {writeJson} from "../util/json_files";

/**
 * A local, structural analog to ai_edits.ts's text-override mechanism: instead of overriding a
 * comment's he/en text, this overrides segment/comment *boundaries* — splitting one Sefaria
 * segment or Rashi/Tosafot comment into two, or merging two adjacent ones into one. Applied by
 * api_request_handler.ts's applySegmentationOverrides, between detectDupes and addAiAdditions.
 *
 * Deliberately explicit, not computed: like ai_edits.ts's Edit, a split's replacement text is
 * fully spelled out here rather than derived on the fly — deciding *how* an approved
 * segmentation_audit.ts finding turns into this exact JSON (by hand, or a future generation step)
 * is a separate concern from applying it.
 */

export const OUTPUT_DIR = "precomputed/segmentation_overrides";

export interface SplitPiece {
  // e.g. "Avodah Zarah 65a:10:split:1" — a literal ":split:<N>" suffix (1-indexed) appended to
  // the entire original ref. No special-casing between segment/comment refs this way: always just
  // append the marker to whatever the original ref already was. ":split:" is also a distinctive,
  // greppable marker other code can check for directly (see ref_expander.ts's hardening) rather
  // than inferring "is this synthetic" from a naming heuristic.
  ref: string;
  hebrew: string;
  english: string;
  // At most one piece across the whole override may set this; defaults to pieces[0] if none do.
  // Governs where the original ref's existing commentary/nested-commentary reattaches.
  attachExistingCommentary?: true;
}

export interface SegmentationSplitOverride {
  kind: "split";
  level: "segment" | "comment";
  originalRef: string; // must currently exist on the page at the given level
  pieces: SplitPiece[]; // length >= 2, ordered left-to-right
}

// No explicit hebrew/english on merge — InternalSegment.merge/Comment.merge already have a
// deterministic way to produce merged text (join existing text with " "), so the override only
// needs to say *which* refs merge, mirroring the existing InternalSegment.merge precedent.
export interface SegmentationMergeOverride {
  kind: "merge";
  level: "segment" | "comment";
  refs: string[]; // length >= 2, ordered, must be contiguous siblings on the page
}

export type SegmentationOverride = SegmentationSplitOverride | SegmentationMergeOverride;

export interface SegmentationOverridesFile {
  overrides: SegmentationOverride[];
}

export function segmentationOverridesForPage(page: string): SegmentationOverridesFile | undefined {
  const fileName = `${OUTPUT_DIR}/${page}.json`;
  if (!fs.existsSync(fileName)) return undefined;
  return JSON.parse(readUtf8(fileName)) as SegmentationOverridesFile;
}

/** Read-modify-write, preserving the rest of the page's overrides — same shape as
 * ai_edits.ts's writeAiEdit. */
export function addSegmentationOverride(page: string, override: SegmentationOverride): void {
  const file = segmentationOverridesForPage(page) ?? {overrides: []};
  file.overrides.push(override);
  fs.mkdirSync(OUTPUT_DIR, {recursive: true});
  writeJson(`${OUTPUT_DIR}/${page}.json`, file);
}
