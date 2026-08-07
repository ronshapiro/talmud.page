import * as fs from "fs";
import {readUtf8} from "../../files";
import {writeJson} from "../../util/json_files";

/**
 * Records what a generated artifact was derived from, so staleness.ts can tell whether it's
 * still valid after Sefaria's underlying text changes. One entry per (taskType, page, ref).
 */
export interface ManifestEntry {
  sourceRefs: string[];
  // Raw source text at generation time (not a hash) — staleness.ts needs the actual text to
  // compute an edit-distance ratio against the current text, not just a fingerprint.
  sourceText: string;
  model: string;
  promptVersion: string;
  generatedAt: string; // ISO 8601
  // Refs this artifact depends on beyond its own sourceRefs (e.g. a table generated from a whole
  // sugya depends on every ref in that sugya, not just the one it's attached to).
  dependsOn: string[];
  confidence?: number;
}

export type PageManifest = Record<string, ManifestEntry>; // keyed by ref

const MANIFEST_DIR = "precomputed/rsi_state/manifest";

function manifestPath(taskType: string, page: string): string {
  return `${MANIFEST_DIR}/${taskType}/${page}.json`;
}

export function readManifestForPage(taskType: string, page: string): PageManifest {
  const fileName = manifestPath(taskType, page);
  if (!fs.existsSync(fileName)) return {};
  return JSON.parse(readUtf8(fileName)) as PageManifest;
}

export function writeManifestForPage(taskType: string, page: string, manifest: PageManifest): void {
  const fileName = manifestPath(taskType, page);
  fs.mkdirSync(`${MANIFEST_DIR}/${taskType}`, {recursive: true});
  writeJson(fileName, manifest);
}

export function readManifestEntry(
  taskType: string, page: string, ref: string,
): ManifestEntry | undefined {
  return readManifestForPage(taskType, page)[ref];
}

/** Read-modify-write a single entry, preserving the rest of the page's manifest. */
export function upsertManifestEntry(
  taskType: string, page: string, ref: string, entry: ManifestEntry,
): void {
  const manifest = readManifestForPage(taskType, page);
  manifest[ref] = entry;
  writeManifestForPage(taskType, page, manifest);
}

/**
 * Refs on this page whose manifest entry declares a dependency on `changedRef` — used to walk
 * cascading invalidation from a Tier 3 (structural break) staleness hit. Only searches the given
 * page; a dependency on a different page's ref won't be found by this alone.
 */
export function findDependentsOnPage(
  taskType: string, page: string, changedRef: string,
): string[] {
  const manifest = readManifestForPage(taskType, page);
  return Object.entries(manifest)
    .filter(([, entry]) => entry.dependsOn.includes(changedRef)
      || entry.sourceRefs.includes(changedRef))
    .map(([ref]) => ref);
}
