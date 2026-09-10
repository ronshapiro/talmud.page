import * as yargs from "yargs";
import {hideBin} from "yargs/helpers";
import {books} from "../books";
import {writeAiEdit} from "../precomputed/ai_edits";
import {commitAndPushPendingCandidates, makeRealCommitPendingDeps} from "./commit_pending";
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
      backend: {
        choices: ["claude", "agy"] as const,
        describe: 'agent backend to use ("claude" or "agy")',
      },
      model: {type: "string", describe: "model override to use for generation"},
      push: {type: "boolean", default: true, describe: "whether to commit and push candidates"},
      debug: {
        type: "boolean",
        default: true,
        describe: "whether to print debugging output for subcommands and progress",
      },
    })
    .parseSync();
  const bookName = FLAGS._[0] as string | undefined;
  if (!bookName || !books.byCanonicalName[bookName]) {
    console.error(
      "Usage: ts-node rashi_tosafot_translation_cli.ts <CanonicalBookName> "
      + "[--section 77] [--limit 2] [--backend agy|claude] [--model <name>] [--no-push] [--no-debug]");
    process.exitCode = 1;
    return;
  }
  const book = books.byCanonicalName[bookName];
  await translateRashiTosafotComments({
    listCandidates: () => {
      let candidates = listCandidatesForBook(book);
      if (FLAGS.section) candidates = candidates.filter(c => c.section.startsWith(FLAGS.section!));
      // Filter freshness before slicing to --limit — otherwise a limit smaller than the run of
      // already-fresh candidates at the start of the page silently does nothing (found the hard
      // way: a real --limit 1 run picked an already-generated candidate, skipped it, and exited
      // with zero output and zero work done).
      candidates = candidates.filter(c => !isFreshTranslation(c));
      const sliced = FLAGS.limit ? candidates.slice(0, FLAGS.limit) : candidates;
      if (FLAGS.debug) {
        console.log(
          `Found ${sliced.length} candidate(s) to process for ${bookName}`
          + `${FLAGS.section ? ` (section ${FLAGS.section})` : ""}.`);
      }
      return sliced;
    },
    isFresh: isFreshTranslation,
    generate: candidate => {
      if (FLAGS.debug) {
        console.log(`\n[Candidate] ${candidate.ref}`);
      }
      return generateAndRecord(candidate, {
        backend: FLAGS.backend,
        model: FLAGS.model,
        debug: FLAGS.debug,
      });
    },
    writeEdit: (candidate, edit) => {
      if (FLAGS.debug) {
        console.log(`Saved pending edit for ${candidate.ref}`);
      }
      writeAiEdit(candidate.page, candidate.ref, edit);
    },
    recordGeneration: recordGenerationForCandidate,
  });
  if (FLAGS.push) {
    if (FLAGS.debug) {
      console.log("\nCommitting and pushing pending candidates...");
    }
    await commitAndPushPendingCandidates(
      `RSI: new pending translation candidates (${bookName})`,
      makeRealCommitPendingDeps({debug: FLAGS.debug}));
  }
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
