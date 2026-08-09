import * as fs from "fs";
import {readUtf8} from "../../files";
import {writeJson} from "../../util/json_files";

/**
 * Records what a generated artifact was derived from, so staleness.ts can tell whether it's
 * still valid after Sefaria's underlying text changes. One record per (taskType, page, ref).
 */
export interface GenerationRecord {
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

export type PageGenerationRecords = Record<string, GenerationRecord>; // keyed by ref

const GENERATION_RECORD_DIR = "precomputed/rsi_state/generation_records";

function generationRecordPath(taskType: string, page: string): string {
  return `${GENERATION_RECORD_DIR}/${taskType}/${page}.json`;
}

export function readGenerationRecordsForPage(
  taskType: string, page: string,
): PageGenerationRecords {
  const fileName = generationRecordPath(taskType, page);
  if (!fs.existsSync(fileName)) return {};
  return JSON.parse(readUtf8(fileName)) as PageGenerationRecords;
}

export function writeGenerationRecordsForPage(
  taskType: string, page: string, records: PageGenerationRecords,
): void {
  const fileName = generationRecordPath(taskType, page);
  fs.mkdirSync(`${GENERATION_RECORD_DIR}/${taskType}`, {recursive: true});
  writeJson(fileName, records);
}

export function readGenerationRecord(
  taskType: string, page: string, ref: string,
): GenerationRecord | undefined {
  return readGenerationRecordsForPage(taskType, page)[ref];
}

/** Read-modify-write a single record, preserving the rest of the page's records. */
export function upsertGenerationRecord(
  taskType: string, page: string, ref: string, record: GenerationRecord,
): void {
  const records = readGenerationRecordsForPage(taskType, page);
  records[ref] = record;
  writeGenerationRecordsForPage(taskType, page, records);
}

/**
 * Refs on this page whose generation record declares a dependency on `changedRef` — used to walk
 * cascading invalidation from a Tier 3 (structural break) staleness hit. Only searches the given
 * page; a dependency on a different page's ref won't be found by this alone.
 */
export function findDependentsOnPage(
  taskType: string, page: string, changedRef: string,
): string[] {
  const records = readGenerationRecordsForPage(taskType, page);
  return Object.entries(records)
    .filter(([, record]) => record.dependsOn.includes(changedRef)
      || record.sourceRefs.includes(changedRef))
    .map(([ref]) => ref);
}
