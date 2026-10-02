// Curation of Mikraot Gedolot commentary: which commentators and which individual comments are
// foundational (tier 1), secondary (tier 2) or omitted (tier 0 / hidden).
//
// The intended workflow for automated (e.g. AI) curation:
//   1. Export a CurationRequest: an inventory of every comment in the document's chapters.
//   2. A tool ranks them and returns a CurationResponse.
//   3. Import the response; it is merged into the document's commentator tiers and
//      commentOverrides, which remain editable by hand.

import {MikraotChapter} from "./dataTypes";
import {CommentOverride, MikraotDocument, Tier} from "./documents";
import {COMMENTATORS_BY_ID} from "./mikraotCommentators";

export const CURATION_VERSION = 1;

export interface CurationRequestComment {
  ref: string;
  commentator: string;
  verse: string;
  hebrew: string;
  english: string;
  currentTier: Tier;
  hidden: boolean;
}

export interface CurationRequest {
  version: number;
  kind: "mikraot-curation-request";
  book: string;
  chapters: [number, number];
  commentators: {id: string; englishName: string; hebrewName: string; currentTier: Tier}[];
  comments: CurationRequestComment[];
  instructions: string;
}

export interface CurationResponse {
  version: number;
  kind: "mikraot-curation";
  // Commentator-level tiers.
  commentators?: Record<string, {tier?: Tier; showEnglish?: boolean}>;
  // Comment-level decisions, keyed by comment ref.
  comments?: Record<string, CommentOverride>;
  // Optional free-form rationale, kept for the reader of the file.
  notes?: string;
}

const INSTRUCTIONS = [
  "For each comment, decide whether it is foundational (tier 1: set prominently),",
  "secondary (tier 2: set smaller), or should be omitted (hidden: true).",
  "Return a JSON object of kind \"mikraot-curation\" with `comments` keyed by ref,",
  "and optionally `commentators` to change a whole commentator's tier.",
].join(" ");

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function buildCurationRequest(
  doc: MikraotDocument,
  chapters: MikraotChapter[],
): CurationRequest {
  const comments: CurationRequestComment[] = [];
  for (const chapter of chapters) {
    for (const config of doc.commentators) {
      const commentator = COMMENTATORS_BY_ID[config.id];
      if (!commentator || commentator.isTargum) continue;
      const commentary = chapter.commentaries[config.id];
      if (!commentary) continue;
      commentary.verses.forEach((verseComments, v) => {
        for (const comment of verseComments) {
          const override = doc.commentOverrides[comment.ref] ?? {};
          comments.push({
            ref: comment.ref,
            commentator: config.id,
            verse: `${chapter.chapter}:${v + 1}`,
            hebrew: stripTags(comment.he),
            english: stripTags(comment.en),
            currentTier: (override.tier ?? config.tier) as Tier,
            hidden: Boolean(override.hidden),
          });
        }
      });
    }
  }
  return {
    version: CURATION_VERSION,
    kind: "mikraot-curation-request",
    book: doc.book,
    chapters: [doc.startChapter, doc.endChapter],
    commentators: doc.commentators
      .filter(x => COMMENTATORS_BY_ID[x.id] && !COMMENTATORS_BY_ID[x.id].isTargum)
      .map(x => ({
        id: x.id,
        englishName: COMMENTATORS_BY_ID[x.id].englishName,
        hebrewName: COMMENTATORS_BY_ID[x.id].hebrewName,
        currentTier: x.tier,
      })),
    comments,
    instructions: INSTRUCTIONS,
  };
}

function isTier(value: unknown): value is Tier {
  return value === 0 || value === 1 || value === 2;
}

/** Validates and merges a curation response into the document. Returns warnings. */
export function applyCuration(
  doc: MikraotDocument,
  response: CurationResponse,
): {doc: MikraotDocument; warnings: string[]} {
  const warnings: string[] = [];
  if (response.kind !== "mikraot-curation") {
    throw new Error(`Expected a "mikraot-curation" file, got ${String(response.kind)}`);
  }

  const commentators = doc.commentators.map(config => {
    const change = response.commentators?.[config.id];
    if (!change) return config;
    const next = {...config};
    if (change.tier !== undefined) {
      if (isTier(change.tier)) next.tier = change.tier;
      else warnings.push(`Invalid tier for ${config.id}: ${String(change.tier)}`);
    }
    if (typeof change.showEnglish === "boolean") next.showEnglish = change.showEnglish;
    return next;
  });
  for (const id of Object.keys(response.commentators ?? {})) {
    if (!doc.commentators.some(x => x.id === id)) warnings.push(`Unknown commentator: ${id}`);
  }

  const commentOverrides = {...doc.commentOverrides};
  for (const [ref, override] of Object.entries(response.comments ?? {})) {
    const clean: CommentOverride = {};
    if (typeof override.hidden === "boolean") clean.hidden = override.hidden;
    if (override.tier !== undefined) {
      if (isTier(override.tier)) clean.tier = override.tier;
      else warnings.push(`Invalid tier for ${ref}: ${String(override.tier)}`);
    }
    if (typeof override.showEnglish === "boolean") clean.showEnglish = override.showEnglish;
    commentOverrides[ref] = {...(commentOverrides[ref] ?? {}), ...clean};
  }

  return {doc: {...doc, commentators, commentOverrides}, warnings};
}

export function setCommentOverride(
  doc: MikraotDocument,
  ref: string,
  change: CommentOverride,
): MikraotDocument {
  const merged: CommentOverride = {...(doc.commentOverrides[ref] ?? {}), ...change};
  for (const key of Object.keys(merged) as (keyof CommentOverride)[]) {
    if (merged[key] === undefined) delete merged[key];
  }
  const commentOverrides = {...doc.commentOverrides};
  if (Object.keys(merged).length === 0) {
    delete commentOverrides[ref];
  } else {
    commentOverrides[ref] = merged;
  }
  return {...doc, commentOverrides};
}
