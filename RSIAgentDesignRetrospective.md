# RSI content agent — retrospective and open design questions

Written after building and running Phase 1 and Phase 2 of `RecursiveSelfImprovingAgentPlan.md`
against real Talmud pages. That doc is the original design; this one is the evidence gathered
since, for a fresh, higher-level pass at the architecture. It doesn't try to pre-decide answers —
where I have a working hypothesis I've said so explicitly, but several of the findings below
point at real tensions in the original design that are worth reconsidering from scratch rather
than patching.

PR: [#54](https://github.com/ronshapiro/talmud.page/pull/54), branch
`worktree-bridge-cse_013nvCXPadZwXNRyPP2mBoCF`, commits `d8e2d119`..`88d135a9`.

## Background (see the original plan for full detail)

Self-hosted, subscription-billed execution: a headless `claude -p` CLI wrapper
(`rsi_orchestrator/headless_claude.ts`) run on a machine the user controls, not a metered API key
and not Anthropic's Managed Agents (rejected specifically over separate-billing concerns). The
generation philosophy was stated as "goal and tools, not a scripted context-assembly function" —
task-type code points Claude at where relevant data lives in the repo and lets it decide what to
read, rather than the orchestrator pre-fetching and assembling a curated prompt payload. Derived
content ships as git-committed JSON, reviewed via PR. A tiered staleness detector
(`precomputed/rsi_state/staleness.ts`) decides whether an existing artifact still matches its
source text. Model routing and budget pacing were designed as *learned* over time from logged
outcomes, not hand-tuned once.

## What's built

**Phase 1** (`precomputed/rsi_state/`, `rsi_orchestrator/`, `js/RsiSuggestionBox.tsx`,
`express.ts`): the staleness detector (exact-match hash / edit-distance ratio / agentic
classification hook / structural break), generation-record provenance tracking, a GitHub-issue
suggestion box in the app UI, and a triage script that reads open suggestions and comments a
feasibility assessment (no auto-implementation).

**Phase 2** (`rsi_orchestrator/rashi_tosafot_translation.ts` +
`rashi_tosafot_translation_cli.ts`): the first real content-generation task type. For a book/page,
finds Rashi/Tosafot comments missing a translation or gone stale, asks Claude to punctuate and
translate each one, runs a bounded self-critique loop (generate → critique → at most one retry
with feedback → give up), writes accepted edits to the existing `precomputed/ai_additions/`
merge mechanism, and records a generation record including model, cost, and now (most recently)
every tool call Claude made while producing the edit.

## What real runs validated

- **Self-critique catches real errors.** Twice, independently, it rejected a translation for a
  genuine and fairly subtle problem (a wrong number relationship in a measurement passage; an
  invented term not present in the source Hebrew) rather than a superficial one.
- **Quality holds up on hard content**, not just short comments — a full page-length Tosafot
  passage with nested cross-references to Temurah and Keritot came back coherent and accurate.
- **The staleness detector and generation-record plumbing work as designed** and are now
  exercised against real data, not just unit tests.
- **Tool-use instrumentation (added most recently) works** and immediately produced usable
  signal — see below.

## Shortcomings and challenges surfaced by real runs

### 1. Context cost and unproductive "wandering"

The philosophy of pointing Claude at a file path and letting it decide what to read ran into a
real, measured problem. `cached_outputs/api_request_handler/<Book>.<page>.json` — the only
context source currently offered beyond the prompt's own inlined source text — is large (345KB
for one page) and mostly irrelevant to a translation task: a size breakdown of one page showed
Rashi + Tosafot together are ~100KB of a 476KB file, with **Mesorat Hashas (a citation index, not
prose) alone accounting for 42% of all commentary bulk**. One real call's usage reported
`cache_read_input_tokens: 157,342` — on the order of the whole file.

Worse: once tool-use instrumentation existed to actually see what Claude reads (not infer it from
token counts), the pattern that emerged wasn't "read the whole file for context" — it was
**searching for worked examples of translation style** across the entire `cached_outputs/`
directory, including unrelated books (Job, Meilah), plus repeated denied `Bash` attempts, plus at
one point reading the pipeline's own source code. That single candidate cost **$0.73** — more
than an entire earlier multi-candidate run. Output quality was fine; the process to get there
was not. Working hypothesis: the prompt gives Claude the source text directly but no worked
example of the *expected output*, so it goes hunting for calibration instead of just producing an
answer. Untested.

This is the crux of the "learned trimming" ask that prompted building the instrumentation: the
project's stated position was explicitly *not* to hand-pick a commentary allowlist, but rather to
build toward something that learns the right amount of context per task type from real usage data.
The instrumentation (`precomputed/rsi_state/context_usage_log.ts`, wired into the translation task
in the most recent commit) is the raw-signal layer for that — but there are currently only 3 real
logged calls, nowhere near enough to learn anything, and no analysis/tuning step exists yet. This
is worth a genuinely fresh design pass: is "let the agent freely explore, log what it does, learn
a trim policy later" the right shape at all, given that *generating* enough data to learn from is
itself expensive under subscription rate limits? Is there a middle path that isn't the rejected
"hand-picked static filter" but also isn't fully unconstrained exploration?

### 2. Model selection wasn't controlled until well after the fact

`headless_claude.ts` didn't pass `--model` for most of Phase 2. `claude -p` picked on its own —
a real run came back mostly `claude-haiku-4-5` with one `claude-sonnet-5` call, none of it
requested by the code. This was only caught by inspecting real generation records, not from any
code review or test. It's now fixed (`--model` pinned per task type, hardcoded to
`claude-sonnet-5` for translation), but the fact that the original design's "Model routing
(learned, not fixed)" section assumed a starting point of *fixed-and-known* model selection, when
the actual starting point was *uncontrolled*, suggests the plan underspecified how model
selection works at the CLI boundary. Worth double-checking there isn't a second, similar gap
elsewhere (e.g. does `--model` reliably pin the model for every internal sub-step the CLI takes,
or only the "primary" one? `primaryModel()` already has to pick the highest-cost entry out of a
`modelUsage` map that can contain more than one model per call — that map's existence is itself
evidence the CLI uses multiple models internally per session, not always the one you asked for.)

### 3. A hidden correctness bug from testing/runtime divergence

`HeadlessClaudeError extends Error`, with an `isRateLimited` field the orchestrator branches on
to decide "stop the whole run" vs. "skip one candidate." `instanceof HeadlessClaudeError` silently
returned `false` at this project's tsconfig target (unset → TypeScript defaults to ES3, and
extending `Error` at that target needs an explicit `Object.setPrototypeOf` fix that wasn't
present). The bug had **100% unit test coverage of the intended behavior, and the tests passed** —
because jest runs through babel-jest, which targets something else and doesn't reproduce the bug.
It was only caught because a real run, after the fix was believed complete, kept logging "Skipping
[ref]: HeadlessClaudeError: session limit" for every remaining candidate instead of stopping once.

This is a structural risk, not a one-off: this codebase runs the *same TypeScript source* through
two different toolchains (`ts-node` for real execution, `babel-jest` for tests) with no guarantee
they agree on language-target-sensitive behavior. Worth asking whether that's an acceptable
standing risk for this subsystem specifically (which runs unattended, with real cost, against
real content) or whether it needs its own safeguard — e.g. a lightweight integration test that
actually runs under `ts-node`, or fixing the tsconfig target properly instead of instance-by-instance
workarounds.

### 4. Two more bugs only found by running real code, not by mocked tests

- `--limit N` on the CLI was applied *before* freshness filtering, so a small `--limit` against a
  page with existing generated content could slice to only already-fresh candidates and silently
  exit having done nothing — no error, no output, exit code 0.
- Both `triage_log.ts` and `context_usage_log.ts` originally hardcoded the production log path
  inside their own test files, with a `fs.rmSync` cleanup step on that same path — meaning running
  the test suite after either log had real accumulated data would silently delete it. This
  actually happened once to `context_usage_log.jsonl` mid-session (recovered from the git index
  before it was lost for good).

Both are now fixed, but the pattern is the point: this project leans heavily on dependency-injected
unit tests with mocked Claude/CLI calls (a deliberate, reasonable choice to avoid spending real
usage on every test run) — and every real bug found so far was found by *actually running the
pipeline*, not by that test suite. Worth thinking about whether some cheap, safe form of
integration testing belongs in this project's standard workflow rather than being ad hoc "let's
try it for real and see."

### 5. Budget reality under subscription billing

The plan accepted "coarser than a spend cap" as a tradeoff for staying on subscription billing
rather than metered API billing. In practice this session hit the Claude Code session/usage limit
**three separate times** across a few hours of real work, each requiring a wait for reset
(observed resets at varying times — 6:10pm, then 11:10pm, then 4:40am Asia/Jerusalem across the
session, suggesting a rolling window rather than a fixed daily reset). The rate-limit-stop logic
now works correctly (see #3), but there's still no proactive pacing — the system finds out it's
out of budget by hitting the wall, not by tracking spend against a target. `claude -p` has a
`--max-budget-usd` flag that's documented but still not wired in anywhere. Also unclear: whether
`--max-budget-usd` is even meaningful under subscription billing (it's phrased as "maximum dollar
amount to spend on API calls" in the CLI's own help text) — that's worth verifying before relying
on it as the budget-control mechanism Phase 4 assumed would exist.

### 6. Self-critique's built-in cost multiplier

Every accepted edit costs at least one generate call + one critique call; a rejected first attempt
doubles that to up to four calls. Given finding #1 (a single generate call can cost $0.73 on its
own), the multiplier compounds an already-expensive step. This was a deliberate design choice
("a bounded loop of a couple of extra calls, not a big loss" per the original plan) made before
real cost data existed. Worth revisiting with that data in hand: is critique-every-time the right
default, or should it be conditional (e.g. skip critique when the generate call's own tool-use
pattern suggests low risk) or sampled?

### 7. No review gate exists yet

Everything generated so far has gone straight from the pipeline into git-committed
`precomputed/ai_additions/` and generation records, with a human (the PR itself) as the only
review surface. The original plan's Phase 3 ("human review loop," explicitly called out as "the
exciting part... don't want to waste time on low-judgment tasks before we've proven the project
works") hasn't been started. Worth deciding whether the current state — real generated Talmud
translations sitting in a PR, reviewable as a diff — is an acceptable interim review mechanism, or
whether Phase 3 needs to move up given real content is now being produced.

### 8. Workflow friction (not architectural, but real)

PR #53's squash-merge left the continuing branch's git ancestry out of sync with `base` — the
branch's `merge-base` pointed at the pre-Phase-1 commit even though its file contents matched.
Required a manual `git rebase --onto` to fix, caught only because it was explicitly asked about.
Minor, but worth a process note for whoever manages future PRs against this branch pattern.

## Concrete data worth carrying into a redesign

- Page JSON size breakdown (`Menachot.80a.json`, 476KB total): base segment text 25KB; Mesorat
  Hashas 190KB (42% of commentary); Rashi 87KB; Steinsaltz 36KB; Verses 34KB; Mishneh Torah 25KB;
  Versions 20KB; Mishnah 17KB; Jastrow 17KB; Tosafot 13KB; Steinsaltz In-Depth 8KB; Tosefta 3KB;
  Kessef Mishneh 1KB.
- Real per-call costs observed: as low as ~$0.09 total (generate + critique, no retry) up to
  $0.73 for a single generate call that went searching the corpus.
- `--output-format stream-json --verbose` is the mechanism now used to recover both cost/model
  attribution and the full tool-use transcript from a single headless call; the plain `json`
  format only gives the final summary.
- Fixed per-session overhead (system prompt + tool definitions) was ~9.5–16K tokens on an early
  probe call, before `--allowedTools` was scoped down to `Read,Grep,Glob`.

## Open questions for the next design pass

1. Is "fully agentic, no pre-assembled context" still the right default given #1, or does it need
   a bounded middle ground — and if so, what decides the bound?
2. How should "learned trimming" actually bootstrap when generating enough data to learn from is
   itself expensive and rate-limited?
3. Should critique run unconditionally, or be made conditional/sampled given its cost multiplier?
4. What does "learned model routing" concretely look like given the CLI's own internal
   multi-model behavior (the `modelUsage` map) isn't fully within this code's control?
5. Is the ts-node/babel-jest target divergence (finding #3) something to fix at the tsconfig
   level, or accept as a standing risk for this subsystem?
6. Does Phase 3 (human review) need to move up in priority now that real content exists in the
   PR, ahead of scaling up generation volume further?
7. Is `--max-budget-usd` meaningful under subscription billing, and if so, at what granularity
   should it be applied (per call? per run? per day)?
