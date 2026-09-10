import * as yargs from "yargs";
import {hideBin} from "yargs/helpers";
import {books} from "../books";
import {writeAiEdit} from "../precomputed/ai_edits";
import {commitAndPushPendingCandidates, realCommitPendingDeps} from "./commit_pending";
import {
  generateAndRecord,
  isFreshTranslation,
  listCandidatesForAllBooks,
  listCandidatesForBook,
  recordGenerationForCandidate,
  runContinuousTranslation,
  translateRashiTosafotComments,
  TranslationCandidate,
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
      continuous: {
        type: "boolean",
        default: false,
        describe: "run continuously for a fixed duration, pausing and checking hourly when quota is exhausted",
      },
      durationHours: {
        type: "number",
        describe: "duration in hours for continuous mode (default: 24)",
      },
      checkIntervalMinutes: {
        type: "number",
        default: 60,
        describe: "interval in minutes to wait before re-checking quota when exhausted (default: 60)",
      },
    })
    .parseSync();

  const isContinuous = Boolean(FLAGS.continuous || FLAGS.durationHours !== undefined);
  const durationHours = FLAGS.durationHours ?? 24;
  const checkIntervalMs = (FLAGS.checkIntervalMinutes ?? 60) * 60 * 1000;

  const bookName = FLAGS._[0] as string | undefined;
  if (!isContinuous && (!bookName || (bookName !== "all" && !books.byCanonicalName[bookName]))) {
    console.error(
      "Usage: ts-node rashi_tosafot_translation_cli.ts [<CanonicalBookName> | all] "
      + "[--section 77] [--limit 2] [--backend agy|claude] [--model <name>] [--no-push] "
      + "[--continuous] [--duration-hours 24] [--check-interval-minutes 60]");
    process.exitCode = 1;
    return;
  }
  if (bookName && bookName !== "all" && !books.byCanonicalName[bookName]) {
    console.error(`Unknown book: "${bookName}"`);
    process.exitCode = 1;
    return;
  }

  const scopeLabel = bookName && bookName !== "all" ? bookName : "all tractates";

  function getCandidates(): TranslationCandidate[] {
    let candidates: TranslationCandidate[];
    if (!bookName || bookName === "all") {
      candidates = listCandidatesForAllBooks();
    } else {
      candidates = listCandidatesForBook(books.byCanonicalName[bookName]);
    }
    if (FLAGS.section) candidates = candidates.filter(c => c.section.startsWith(FLAGS.section!));
    return candidates;
  }

  if (isContinuous) {
    await runContinuousTranslation({
      listCandidates: getCandidates,
      isFresh: isFreshTranslation,
      generate: candidate => generateAndRecord(candidate, {
        backend: FLAGS.backend,
        model: FLAGS.model,
      }),
      writeEdit: (candidate, edit) => writeAiEdit(candidate.page, candidate.ref, edit),
      recordGeneration: recordGenerationForCandidate,
      onProgress: FLAGS.push
        ? async () => {
          await commitAndPushPendingCandidates(
            `RSI: new pending translation candidates (${scopeLabel})`, realCommitPendingDeps);
        }
        : undefined,
      durationMs: durationHours * 60 * 60 * 1000,
      checkIntervalMs,
    });
  } else {
    await translateRashiTosafotComments({
      listCandidates: () => {
        let candidates = getCandidates();
        // Filter freshness before slicing to --limit — otherwise a limit smaller than the run of
        // already-fresh candidates at the start of the page silently does nothing (found the hard
        // way: a real --limit 1 run picked an already-generated candidate, skipped it, and exited
        // with zero output and zero work done).
        candidates = candidates.filter(c => !isFreshTranslation(c));
        return FLAGS.limit ? candidates.slice(0, FLAGS.limit) : candidates;
      },
      isFresh: isFreshTranslation,
      generate: candidate => generateAndRecord(candidate, {
        backend: FLAGS.backend,
        model: FLAGS.model,
      }),
      writeEdit: (candidate, edit) => writeAiEdit(candidate.page, candidate.ref, edit),
      recordGeneration: recordGenerationForCandidate,
    });
    if (FLAGS.push) {
      await commitAndPushPendingCandidates(
        `RSI: new pending translation candidates (${scopeLabel})`, realCommitPendingDeps);
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
