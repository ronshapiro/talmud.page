import * as yargs from "yargs";
import {hideBin} from "yargs/helpers";
import {books} from "../books";
import {
  generateAndRecord,
  isFreshAudit,
  listCandidatesForBook,
  recordGenerationForCandidate,
  runSegmentationAudit,
  writeAuditSuggestions,
} from "./segmentation_audit";

/**
 * CLI entrypoint, kept separate from segmentation_audit.ts for the same reason as
 * rashi_tosafot_translation_cli.ts: `yargs` ships ESM-only and breaks under jest.
 */
async function main(): Promise<void> {
  const FLAGS = yargs(hideBin(process.argv))
    .options({
      section: {type: "string", describe: 'e.g. "77" (matches 77a/77b) or "77a" (exact)'},
      limit: {type: "number", describe: "cap the number of pages audited"},
    })
    .parseSync();
  const bookName = FLAGS._[0] as string | undefined;
  if (!bookName || !books.byCanonicalName[bookName]) {
    console.error(
      "Usage: ts-node segmentation_audit_cli.ts <CanonicalBookName> [--section 77] [--limit 2]");
    process.exitCode = 1;
    return;
  }
  const book = books.byCanonicalName[bookName];
  await runSegmentationAudit({
    listCandidates: () => {
      let candidates = listCandidatesForBook(book);
      if (FLAGS.section) candidates = candidates.filter(c => c.section.startsWith(FLAGS.section!));
      // Filter freshness before slicing to --limit — see rashi_tosafot_translation_cli.ts's
      // comment on the same pattern for why this ordering matters.
      candidates = candidates.filter(c => !isFreshAudit(c));
      return FLAGS.limit ? candidates.slice(0, FLAGS.limit) : candidates;
    },
    isFresh: isFreshAudit,
    generate: generateAndRecord,
    writeSuggestions: (candidate, result) => writeAuditSuggestions(candidate.page, result),
    recordGeneration: recordGenerationForCandidate,
  });
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
