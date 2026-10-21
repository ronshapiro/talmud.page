import * as fs from "fs";
import {Amud} from "../../apiTypes";
import {Book} from "../../books";
import {cachedOutputFilePath} from "../../cached_outputs";
import {readUtf8} from "../../files";

/**
 * A compact, per-page structural index — ordered segment refs and which commentaries exist with
 * how many comments each has. Deliberately excludes full comment text
 * (a real page's full cached JSON can be 400KB+, most of it irrelevant to any single generation
 * task) — this is what a task-type prompt inlines instead of pointing at the raw cached file, with
 * `context_fetch` available for anything the skeleton alone doesn't answer.
 */

export interface SegmentSkeleton {
  ref: string;
  commentary: Record<string, number>; // commentary name -> comment count
}

export interface PageSkeleton {
  page: string;
  segments: SegmentSkeleton[];
}

export function buildPageSkeleton(book: Book, section: string): PageSkeleton | undefined {
  const filePath = cachedOutputFilePath(book, section);
  if (!fs.existsSync(filePath)) return undefined;
  const amud = JSON.parse(readUtf8(filePath)) as Amud;
  const segments: SegmentSkeleton[] = amud.sections.map(segment => {
    const commentary: Record<string, number> = {};
    for (const [name, entry] of Object.entries(segment.commentary ?? {})) {
      commentary[name] = entry.comments.length;
    }
    return {ref: segment.ref, commentary};
  });
  return {page: `${book.canonicalName} ${section}`, segments};
}

/** Renders a skeleton as plain text suitable for inlining directly into a generation prompt. */
export function formatPageSkeleton(skeleton: PageSkeleton): string {
  return skeleton.segments.map(segment => {
    const commentaryList = Object.entries(segment.commentary)
      .map(([name, count]) => `${name}(${count})`)
      .join(", ");
    return `${segment.ref} — commentary: ${commentaryList || "none"}`;
  }).join("\n");
}
