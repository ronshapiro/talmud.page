---
name: evaluate-rashi-model
description: Evaluates a new Rashi/Tosafot translation model against an existing baseline model using a symmetric N-page crossover (new generator / old critique vs old generator / new critique) on a chosen tractate, then analyzes quantitative metrics and translation/critique quality.
metadata:
  version: 1.0.0
---

# Evaluate Rashi Translation Model Skill

Use this skill when asked to evaluate a new model against a baseline ("old") model for Rashi and Tosafot translation across a tractate (`masechet`) and `# of pages` (`N`), using a symmetric crossover design:

- **Block A (`N` clean pages)**: `new_model` as **generator**, `old_model` as **critique**
- **Block B (`N` clean pages)**: `old_model` as **generator**, `new_model` as **critique**

> [!NOTE]
> Keep `rsi_orchestrator/` and `precomputed/rsi_state/model_routing_config.json` unmodified during an evaluation run unless the user explicitly asks to add or change production presets. Pass `--model` and `--critique-model` (plus `--backend` / `--critique-backend`) directly to `rashi_tosafot_translation_cli.ts`.

---

## 1. Required Inputs & Defaults

Confirm or resolve these four parameters from the user's request:

1. **`new_model`** (and its backend, e.g. `agy`, `claude`, `ollama`, `gemini-api`):
   - For `agy`, verify exact model IDs (including effort suffix like `-medium`, `-high`) via `agy models`.
   - Check `precomputed/rsi_state/model_routing_config.json` to match existing effort conventions (currently `-medium` across active `agy` presets).
2. **`old_model`** (and its critique/generator backend):
   - Defaults to the current `agy` baseline in `precomputed/rsi_state/model_routing_config.json` (`gemini-3.8-flash-medium`) if unspecified.
3. **`masechet`**:
   - Tractate name or alias (e.g. `Taanit`, `Shevuot`). Canonical name lookup is handled by `books.canonicalNameOrUndefined(...)`.
4. **`num_pages` (`N`)**:
   - Number of pages per direction (`N` pages for Block A + `N` pages for Block B = `2 * N` total pages).

---

## 2. Pre-Flight: Inspect Tractate & Select `2 * N` Clean Pages

Before starting any translation run:

1. **Check for colliding background runs**:
   ```bash
   ps aux | grep -E "rashi_tosafot_translation_cli" | grep -v grep || true
   ```
   Do not run two evaluations on the same pages concurrently.

2. **Find `2 * N` consecutive completely untranslated (`fresh === 0`) cached pages**:
   Write a temporary inspection script outside the repository (e.g. in your artifact scratch directory) and run it with `npx ts-node --project tsconfig.json <scratch_script.ts>`:
   ```ts
   import {books} from "<repo>/books";
   import {
     isFreshTranslation,
     listCandidatesForBook,
   } from "<repo>/rsi_orchestrator/rashi_tosafot_translation";

   const book = books.canonicalNameOrUndefined("<masechet>");
   if (!book) throw new Error("Unknown masechet");
   const stats = new Map<string, {total: number; fresh: number; rashi: number; tosafot: number}>();
   for (const candidate of listCandidatesForBook(books.byCanonicalName[book])) {
     const entry = stats.get(candidate.section) ?? {total: 0, fresh: 0, rashi: 0, tosafot: 0};
     entry.total++;
     if (isFreshTranslation(candidate)) {
       entry.fresh++;
     } else if (candidate.commentator === "Rashi") {
       entry.rashi++;
     } else {
       entry.tosafot++;
     }
     stats.set(candidate.section, entry);
   }
   for (const [section, s] of stats.entries()) {
     if (s.fresh === 0) {
       console.log(`${section}: ${s.total} unfresh (${s.rashi} Rashi / ${s.tosafot} Tosafot)`);
     }
   }
   ```
   - Pick the first `N` consecutive clean pages (`fresh === 0`) for **Block A** and the next `N` consecutive clean pages for **Block B**.
   - Avoid partially translated pages so neither block mixes baseline and evaluation records.
   - Verify the two blocks have roughly comparable comment counts (Rashi/Tosafot mix) and note any skew in your final analysis.

3. **Smoke-test a new model (optional, recommended for unfamiliar models)**:
   Run 1 candidate on the first page of Block A with `--limit 1 --no-push`:
   ```bash
   npx ts-node rsi_orchestrator/rashi_tosafot_translation_cli.ts <Book> \
     --section <first_page> --limit 1 \
     --backend <new_backend> --model <new_model> \
     --critique-backend <old_backend> --critique-model <old_model> \
     --no-push
   ```
   (Because the translation is recorded on disk, Block A will pick up cleanly from candidate #2 when started.)

---

## 3. Running the Two `N`-Page Blocks

### Important CLI & Orchestrator Gotchas

1. **Do NOT use `--continuous` for fixed-page evaluation**:
   `runContinuousTranslation` in `rsi_orchestrator/rashi_tosafot_translation.ts` loops as long as any candidate remains `!isFresh(c)`. If a stubborn comment exhausts `MAX_GENERATION_ATTEMPTS` (5) and is skipped without a generation record, `--continuous` would spin retrying it until `--duration-hours` expires.
2. **Always pass full amud sections to `--section`**:
   `rashi_tosafot_translation_cli.ts` filters with `candidate.section.startsWith(FLAGS.section!)`. Full amud strings (`3b`, `10a`) match uniquely, whereas a bare daf like `3` would also match `30a`, `30b`, `31a`.
3. **Pass `--no-push` during the evaluation runs**:
   Running with `--no-push` avoids premature `git commit` / `git push` / `updateApiRequestHandlerTestsViaCli` calls, allowing Block A and Block B to run safely in parallel in the same worktree on disjoint pages.
4. **Always capture `--debug` stdout/stderr with ISO timestamps to log files**:
   `context_usage_log` records `toolUses`, `model`, `costUsd`, and `timestamp`, **not** `[critique] rejected: <reason>`, `[retry] feedback...`, `Giving up...`, or deterministic Hebrew verification failures. Only the CLI stdout (enabled by default with `--debug=true`) contains those signals.

### Parallel Section-Runner Pattern

Write a temporary runner script (in your scratch directory, outside the repo) that runs each block's pages sequentially while saving timestamped logs and sleeping/retrying only on rate-limit stops (`Stopping: hit the usage limit`):

```ts
import {spawn} from "child_process";
import * as fs from "fs";
import * as path from "path";

// Args: <book> <genBackend> <genModel> <critBackend> <critModel> <logPath> <s1,s2,...>
const [book, genBackend, genModel, critBackend, critModel, logPath, sectionsCsv] = process.argv.slice(2);
const sections = sectionsCsv.split(",").map(s => s.trim()).filter(Boolean);
const RATE_LIMIT_SLEEP_MS = 30 * 60 * 1000;

fs.mkdirSync(path.dirname(logPath), {recursive: true});
const logStream = fs.createWriteStream(logPath, {flags: "a"});
const logLine = (line: string) => {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  logStream.write(`${stamped}\n`);
};

function runSection(section: string): Promise<{code: number | null; hitRateLimit: boolean}> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", [
      "ts-node", "rsi_orchestrator/rashi_tosafot_translation_cli.ts",
      book, "--section", section,
      "--backend", genBackend, "--model", genModel,
      "--critique-backend", critBackend, "--critique-model", critModel,
      "--no-push",
    ], {stdio: ["ignore", "pipe", "pipe"], env: process.env});
    let hitRateLimit = false;
    let outBuf = "";
    let errBuf = "";
    const flush = (buf: string, isErr: boolean) => {
      const lines = buf.split("\n");
      const tail = lines.pop() ?? "";
      for (const line of lines) {
        if (isErr && /Stopping: hit the usage limit/i.test(line)) hitRateLimit = true;
        logLine(isErr ? `[ERR] ${line}` : line);
      }
      return tail;
    };
    child.stdout?.on("data", c => { outBuf = flush(outBuf + c.toString(), false); });
    child.stderr?.on("data", c => { errBuf = flush(errBuf + c.toString(), true); });
    child.on("error", reject);
    child.on("close", code => {
      if (outBuf.trim()) logLine(outBuf);
      if (errBuf.trim()) {
        if (/Stopping: hit the usage limit/i.test(errBuf)) hitRateLimit = true;
        logLine(`[ERR] ${errBuf}`);
      }
      resolve({code, hitRateLimit});
    });
  });
}

(async () => {
  for (const section of sections) {
    while (true) {
      const {code, hitRateLimit} = await runSection(section);
      if (code !== 0) process.exit(code ?? 1);
      if (!hitRateLimit) break;
      logLine(`[Runner] Usage limit hit on ${book} ${section}; sleeping 30m...`);
      await new Promise(r => setTimeout(r, RATE_LIMIT_SLEEP_MS));
    }
  }
})().finally(() => logStream.end());
```

Launch **Block A** and **Block B** in parallel (`IsDaemon: false` so Antigravity notifies you automatically when each finishes) — or sequentially if quota is tight:
- **Block A**: `<book> <new_backend> <new_model> <old_backend> <old_model> <scratch>/blockA.log <page1,...,pageN>`
- **Block B**: `<book> <old_backend> <old_model> <new_backend> <new_model> <scratch>/blockB.log <pageN+1,...,page2N>`

---

## 4. Analyze Performance Across Both Scenarios

Once both blocks finish, write an analysis script in your scratch directory combining all four artifact/log sources per block:
1. Timestamped runner logs (`blockA.log`, `blockB.log`)
2. `precomputed/rsi_state/context_usage_log/rashi_tosafot_translation/<Book> <page>.jsonl`
3. `precomputed/rsi_state/generation_records/rashi_tosafot_translation/<Book>/<page>.json`
4. `precomputed/ai_additions/<Book>/<page>.json` + source candidates from `listCandidatesForBook`

### Metrics to Compute per Block (and Split by Rashi vs Tosafot)

1. **Completion & Acceptance Rates**:
   - Total candidates vs saved (`ai_additions` + `generation_records`) vs give-ups (`Giving up on ... after 5 attempts`) vs unexpected errors (`Skipping ...`)
   - **First-pass acceptance rate**: candidates accepted on attempt 1 with zero retries (`1 gen + 1 crit`)
   - **Attempt distribution**: 1, 2, 3, 4, 5 attempts, and give-ups
2. **Rejection Root Causes**:
   - **Local Hebrew verification rejections** (`verifyProposedHebrewWording` — e.g. modified source text outside `<span class="explanation">`, unclosed `<span>`, mismatched `<abbr>` tags, missing `<abbr title>`, or wrapping untouchable abbreviations like `וגו'`/`וכו'`/`הקב"ה`/`רש"י`/`חז"ל`): identifiable both from `[retry] feedback` in stdout and from consecutive `generate` calls in `context_usage_log` with no `critique` call in between.
   - **Malformed JSON / agent errors**: parse failures or CLI errors retried with feedback.
   - **Critique rejections**: count and categorize every `[critique] rejected: <reason>` line (abbreviation rule disputes, dibur hamatchil / punctuation, English translation accuracy/omission, explanation span usage, false-positive nitpicks vs valid catches).
3. **Latency, Token Burn & Cost-Effectiveness**:
   - **Wall-clock latency & throughput**: seconds per `generate` call, per `critique` call, and total per candidate (mean, median, p95, total block runtime) parsed from timestamped stdout logs.
   - **Subscription / quota footprint (for CLI backends like `agy`)**: `callsPerSaved` (`gen` + `crit` calls divided by saved candidates) and total tool turns per call/block, distinguishing avoidable format/prompt-churn retries from genuine quality retries.
   - **Direct API cost (`costUsd`)**: sum and average `costUsd` from `context_usage_log` when reported by the backend (`claude`, `gemini-api`).
   - **Token & multi-turn probing (when `costUsd` is `undefined`, e.g. `agy`)**: `context_usage_log` omits `usage` token counts even though `runHeadlessAgy` receives `input_tokens`, `cache_read_tokens`, `output_tokens`, and `thinking_tokens` (counted toward billed output on Gemini models). Run a small controlled probe from your scratch script calling `agy -p --output-format stream-json --model <model>` with the real generator and critique prompts on 3–5 representative comments (e.g. a short Rashi, a context-fetch-heavy Rashi, and a Tosafot) parsed via `parseAgyStreamJsonLines` (from `rsi_orchestrator/agent_runner.ts`), and cross-check probed tool counts against full-block averages. Note any CLI system-prompt/tool-schema baseline overhead when extrapolating from `agy` probes to `--backend gemini-api`.
   - **Cost per accepted edit & 2x2 pairing projection**: combine published per-1M pricing (uncached input, cached input read, and output *including* thinking tokens — checking both introductory/promotional rates and standard post-introductory rates, plus Batch/Flex if applicable) with per-call token profiles and observed `callsPerSaved` multipliers to estimate cost per saved comment and per 1,000 comments across all four pairings (`new+old`, `old+new`, `new+new`, `old+old`), including a normalized retry-rate comparison if one model suffered preventable prompt-rule churn.
4. **Context Fetch & All-Tool Behavior**:
   - Run `computeContextReport` (from `rsi_orchestrator/context_usage_report.ts`) filtered to each block's pages for both `callKind: "generate"` and `callKind: "critique"` to compare `fetch%`, `refs/fetch`, `own-seg%`, `off-page%`, `off-book%`, `2a-3b%`, and subcommand counts (`get-refs`, `get-neighbors`, `search`, `get-comment-refs`, `get-prior-sugyot`, `wikipedia`).
   - Also tally **all** `toolUses` types directly from `context_usage_log` (`run_command` vs `read_file`, `search_web`, etc.), because `computeContextReport` only inspects `run_command` calls and `runHeadlessAgy`'s `allowedTools` filter does not block `read_file` wandering — unnecessary `read_file` loops inflate latency, multi-turn uncached input, and cache-read token cost.
   - Check whether the critique model respected the no-lookup instruction (`0` disallowed `read_file`/`search_web` calls and `fetch%` near `0%`, except rare Wikipedia checks).

### Qualitative & Crossover Audit

Inspect actual Hebrew + English edits in `precomputed/ai_additions/<Book>/<page>.json` against source text (from `listCandidatesForBook`):
- **Spot-check accepted attempt-1 outputs** across both blocks (short Rashi, multi-step Gemara explanation, and long Tosafot).
- **Audit rejected-then-accepted pairs**: look at `[critique] rejected: <reason>` vs the final saved edit to classify whether each critique rejection was a **genuine catch** (wrong English, missed `<abbr>`, altered Hebrew, bad punctuation) or a **false positive / over-strict nitpick** (e.g. flagging valid `<abbr>` expansions, demanding unnecessary `<span class="explanation">`, or misunderstanding valid Talmudic idiom).
- **Inspect every give-up (if any)** to see whether the generator failed to follow feedback or the critique was miscalibrated.

### Report Format

Present a clear comparative summary covering:
1. Side-by-side metrics table (`Block A: new gen / old crit` vs `Block B: old gen / new crit`)
2. Rejection & failure breakdown (verification vs JSON vs critique categories, with genuine-catch vs false-positive assessment)
3. Speed & context/all-tool fetch comparison (including any non-`run_command` tool wandering)
4. Cost-effectiveness & token/tool-turn efficiency (per-comment and per-1,000-comment API-equivalent cost at current and standard pricing across pairings, token/thinking/tool-turn drivers, and subscription call/turn/wall-clock efficiency)
5. Qualitative translation highlights & concrete examples (with exact `ref` links/citations)
6. Recommendation on whether `new_model` improves over `old_model` as generator, as critique, both, or neither — weighing quality, speed, and cost-effectiveness (and whether another effort level should be tested).

---

## 5. Finalize Test Data & Open PR

Once both blocks and analysis are complete:

1. **Update cached handler test data** (same step `commit_pending.ts` runs):
   ```bash
   npx ts-node __tests__/api_request_handler_runner.ts --use_cached_inputs true
   ```
2. **Commit before running `npm test` / `pre-commit`**:
   - Confirm no temporary/scratch files exist inside the repository (`git status`).
   - Stage `.agents/skills/evaluate-rashi-model/SKILL.md` (if added/updated), `precomputed/ai_additions/...`, `precomputed/rsi_state/...`, and `test_data/api_request_handler/...` and commit with `--no-verify` (matching `commit_pending.ts`, because `rsi_orchestrator/commit_pending.test.ts` invokes `commitPendingState("Test commit message")` during `npm test` and will commit any uncommitted or staged `MANAGED_PATHS` files if `pre-commit` runs `npm test`).
   - Commit with a concise, complete sentence (no Conventional Commit prefixes).
3. **Verify checks, push, and open a PR**:
   - Run `pre-commit/custom.sh` and `npm test` on the clean committed tree (verifying `git log -n 2` shows your clean commit and `git status` is clean), push with `git push -u origin HEAD`, and create a PR summarizing the crossover evaluation results.
