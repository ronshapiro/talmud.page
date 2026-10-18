import * as fs from "fs";
import * as yargs from "yargs";
import {hideBin} from "yargs/helpers";
import {books} from "../books";
import {Edit} from "../precomputed/ai_edits";
import {AgentBackend} from "./agent_runner";
import {
  critiqueViaAgent,
  generateViaAgent,
  listCandidatesForAllBooks,
  listCandidatesForBook,
  TranslationCandidate,
} from "./rashi_tosafot_translation";

/**
 * Model evaluation harness for Rashi/Tosafot translation: runs ONE generation attempt per comment
 * on a single page with a (typically local) generator backend, has a stronger judge backend
 * critique it, and reports verdicts and inference time. Deliberately does not retry, write
 * edits, or record generation records — it's for comparing models on the same page, so rerun with
 * the same `--page` and a different `--model`.
 *
 * Kept separate from the main CLI for the same reason (yargs is ESM-only under jest).
 */

// Small linear congruential PRNG so `--seed` makes the "random" page reproducible.
function seededRandom(seed: number): () => number {
  const modulus = 4294967296;
  let state = Math.abs(Math.floor(seed)) % modulus;
  return () => {
    state = (state * 1664525 + 1013904223) % modulus;
    return state / modulus;
  };
}

function pickRandomPage(random: () => number): string {
  const pages = Array.from(new Set(listCandidatesForAllBooks().map(candidate => candidate.page)));
  return pages[Math.floor(random() * pages.length)];
}

interface CommentResult {
  ref: string;
  commentator: string;
  hebrewSource: string;
  edit?: Edit;
  generateError?: string;
  generateSeconds: number;
  ollamaSeconds?: number;
  valid?: boolean;
  critiqueReason?: string;
  critiqueSeconds?: number;
}

async function main(): Promise<void> {
  const FLAGS = yargs(hideBin(process.argv))
    .options({
      page: {type: "string", describe: 'page to evaluate, e.g. "Menachot 100a" (default: random)'},
      seed: {type: "number", describe: "seed for the random page choice"},
      model: {type: "string", default: "gemma4:e4b", describe: "ollama model to evaluate"},
      generateBackend: {type: "string", default: "ollama"},
      critiqueBackend: {type: "string", default: "agy", describe: "judge backend"},
      critiqueModel: {type: "string", describe: "judge model (default: backend's routing default)"},
      limit: {type: "number", describe: "cap the number of comments evaluated"},
      out: {type: "string", describe: "write full JSON results to this path"},
    })
    .parseSync();

  const seed = FLAGS.seed ?? Math.floor(Math.random() * 1e9);
  const page = FLAGS.page ?? pickRandomPage(seededRandom(seed));
  if (!FLAGS.page) console.log(`Randomly picked page "${page}" (seed ${seed})`);

  const [bookName] = page.split(/ (?=\S+$)/);
  const book = books.byCanonicalName[bookName];
  if (!book) throw new Error(`Unknown book in page "${page}"`);
  let candidates: TranslationCandidate[] = listCandidatesForBook(book)
    .filter(candidate => candidate.page === page);
  if (FLAGS.limit !== undefined) candidates = candidates.slice(0, FLAGS.limit);
  console.log(
    `Evaluating ${candidates.length} comments on ${page} | generator: `
    + `${FLAGS.generateBackend}/${FLAGS.model} | judge: ${FLAGS.critiqueBackend}`);

  const results: CommentResult[] = [];
  for (const candidate of candidates) {
    const result: CommentResult = {
      ref: candidate.ref,
      commentator: candidate.commentator,
      hebrewSource: candidate.hebrewSource,
      generateSeconds: 0,
    };
    results.push(result);
    const generateStart = Date.now();
    try {
      // eslint-disable-next-line no-await-in-loop
      const generated = await generateViaAgent(candidate, undefined, {
        backend: FLAGS.generateBackend as AgentBackend,
        model: FLAGS.model,
      });
      result.generateSeconds = (Date.now() - generateStart) / 1000;
      result.ollamaSeconds = generated.durationSeconds;
      result.edit = generated.edit;
    } catch (e) {
      result.generateSeconds = (Date.now() - generateStart) / 1000;
      result.generateError = String(e);
      console.log(`[${results.length}/${candidates.length}] ${candidate.ref}: GENERATE ERROR ${e}`);
      continue;
    }
    const critiqueStart = Date.now();
    try {
      // eslint-disable-next-line no-await-in-loop
      const outcome = await critiqueViaAgent(candidate, result.edit, {
        backend: FLAGS.generateBackend as AgentBackend,
        critiqueBackend: FLAGS.critiqueBackend as AgentBackend,
        critiqueModel: FLAGS.critiqueModel,
      });
      result.valid = outcome.verdict.valid;
      result.critiqueReason = outcome.verdict.reason;
    } catch (e) {
      result.critiqueReason = `CRITIQUE ERROR: ${e}`;
    }
    result.critiqueSeconds = (Date.now() - critiqueStart) / 1000;
    console.log(
      `[${results.length}/${candidates.length}] ${candidate.ref}: `
      + `${result.valid ? "PASS" : "FAIL"} (gen ${result.generateSeconds.toFixed(1)}s)`
      + `${result.valid ? "" : ` — ${result.critiqueReason}`}`);
  }

  const generated = results.filter(r => r.edit);
  const passed = results.filter(r => r.valid).length;
  const totalGenerateSeconds = results.reduce((sum, r) => sum + r.generateSeconds, 0);
  console.log("\n=== Summary ===");
  console.log(`Page: ${page}`);
  console.log(`Generator: ${FLAGS.generateBackend}/${FLAGS.model}`);
  console.log(`Generated: ${generated.length}/${results.length}`);
  console.log(`Judge-approved (first attempt): ${passed}/${results.length}`);
  console.log(
    `Generation time: total ${totalGenerateSeconds.toFixed(1)}s, `
    + `mean ${(totalGenerateSeconds / Math.max(results.length, 1)).toFixed(1)}s/comment`);
  if (FLAGS.out) {
    const report = {page, seed, model: FLAGS.model, results};
    fs.writeFileSync(FLAGS.out, JSON.stringify(report, undefined, 2));
    console.log(`Wrote ${FLAGS.out}`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
