import * as yargs from "yargs";
import {hideBin} from "yargs/helpers";
import {books} from "../books";
import {writeAiEdit} from "../precomputed/ai_edits";
import {
  generateAndRecord,
  isFreshTranslation,
  listCandidatesForBook,
  recordGenerationForCandidate,
  translateRashiTosafotComments,
} from "./rashi_tosafot_translation";

/**
 * CLI entrypoint, kept separate from rashi_tosafot_translation.ts because `yargs` ships ESM-only
 * and breaks under jest — this file is never imported by a test, so it's fine for it to depend on
 * yargs; the core module (which the test file does import) stays jest-safe.
 */
async function main(): Promise<void> {
  const FLAGS = yargs(hideBin(process.argv))
    .options({
      section: {type: "string", describe: 'e.g. "77" (matches 77a/77b) or "77a" (exact)'},
      limit: {type: "number", describe: "cap the number of candidates processed"},
    })
    .parseSync();
  const bookName = FLAGS._[0] as string | undefined;
  if (!bookName || !books.byCanonicalName[bookName]) {
    console.error(
      "Usage: ts-node rashi_tosafot_translation_cli.ts <CanonicalBookName> "
      + "[--section 77] [--limit 2]");
    process.exitCode = 1;
    return;
  }
  const book = books.byCanonicalName[bookName];
  await translateRashiTosafotComments({
    listCandidates: () => {
      let candidates = listCandidatesForBook(book);
      if (FLAGS.section) candidates = candidates.filter(c => c.section.startsWith(FLAGS.section!));
      return FLAGS.limit ? candidates.slice(0, FLAGS.limit) : candidates;
    },
    isFresh: isFreshTranslation,
    generate: generateAndRecord,
    writeEdit: (candidate, edit) => writeAiEdit(candidate.page, candidate.ref, edit),
    recordGeneration: recordGenerationForCandidate,
  });
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
