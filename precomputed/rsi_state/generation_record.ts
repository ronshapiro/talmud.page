import * as fs from "fs";
import {readUtf8} from "../../files";
import {splitOnBookName} from "../../refs";
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
  // Total cost of every model call that went into producing this artifact (including rejected
  // attempts a self-critique loop retried) — not just the final accepted call. Undefined if the
  // task type doesn't report cost.
  costUsd?: number;
  // Refs this artifact depends on beyond its own sourceRefs (e.g. a table generated from a whole
  // sugya depends on every ref in that sugya, not just the one it's attached to).
  dependsOn: string[];
  confidence?: number;
  taskVersion?: string;
}

export type PageGenerationRecords = Record<string, GenerationRecord>; // keyed by ref

const GENERATION_RECORD_DIR = "precomputed/rsi_state/generation_records";

export function generationRecordPath(taskType: string, page: string): string {
  if (!page.includes(" ")) {
    return `${GENERATION_RECORD_DIR}/${taskType}/${page}.json`;
  }
  const [book, pageName] = splitOnBookName(page);
  return `${GENERATION_RECORD_DIR}/${taskType}/${book}/${pageName}.json`;
}

/** Every page with at least one generation record for this task type — used to find worked
 * examples of past accepted output (see rashi_tosafot_translation.ts's generationPrompt). */
export function listPagesWithGenerationRecords(taskType: string): string[] {
  const taskDirectory = `${GENERATION_RECORD_DIR}/${taskType}`;
  if (!fs.existsSync(taskDirectory)) return [];
  const pages: string[] = [];
  try {
    const entries = fs.readdirSync(taskDirectory, {withFileTypes: true});
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const entryPath = `${taskDirectory}/${entry.name}`;
        try {
          const files = fs.readdirSync(entryPath);
          for (const fileName of files) {
            if (fileName.endsWith(".json")) {
              const pageName = fileName.slice(0, -".json".length);
              pages.push(`${entry.name} ${pageName}`);
            }
          }
        } catch {
          // Directory may have been deleted concurrently
        }
      }
    }
  } catch {
    // Task directory may have been modified or deleted
  }
  return pages;
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
  const directory = fileName.slice(0, fileName.lastIndexOf("/"));
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {recursive: true});
  }
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

/**
 * Looks up a generation record across any registered task type on the page.
 */
export function findGenerationRecord(
  page: string, ref: string,
): GenerationRecord | undefined {
  if (!fs.existsSync(GENERATION_RECORD_DIR)) return undefined;
  for (const entry of fs.readdirSync(GENERATION_RECORD_DIR)) {
    const taskDirPath = `${GENERATION_RECORD_DIR}/${entry}`;
    if (fs.statSync(taskDirPath).isDirectory()) {
      const record = readGenerationRecord(entry, page, ref);
      if (record) return record;
    }
  }
  return undefined;
}
