# RSI content agent — redesign plan

## Context

talmud.page pulls almost all text from the Sefaria API and stores everything else — derived
translations, indices, corrections — as files in the git repo (no database). PR #53 (merged, on
`base`) built Phase 1 of a "recursive self-improving" content-agent system: a tiered staleness
detector, a generation-record/provenance store, a GitHub-issue-based suggestion box, and an
orchestrator that shells out to the `claude` CLI headlessly (`claude -p`) so usage draws on the
existing Claude Code subscription rather than metered API billing. PR #54 (unmerged, branch
`worktree-bridge-cse_013nvCXPadZwXNRyPP2mBoCF`) built Phase 2 on top of that: the first real task
type (Rashi/Tosafot translation+punctuation), and ran it for real against live pages.

Those real runs are the reason this plan exists. `RSIAgentDesignRetrospective.md` (written after
those runs, on the PR #54 branch) documents concrete failures the original design didn't
anticipate: a single translation call cost **$0.73** because Claude, given a goal and raw
filesystem access but no worked example of the expected output, went searching across unrelated
books for calibration instead of just answering; model selection was silently uncontrolled until
caught by inspecting real generation records, not by test or review; there is no proactive budget
pacing, only "hit the wall and stop"; and there is no human review gate — generated content flows
straight into git-committed `precomputed/ai_additions/`.

This plan is the "fresh, higher-level pass" that retrospective explicitly invited. It keeps what
real runs validated (the staleness detector, the generation-record schema, self-critique, the
headless-CLI/subscription-billing substrate) and redesigns the two things that actually broke:
**how context is provided to the agent**, and **how spend is controlled and made visible to a
human who shares this subscription with other work**. It also adds the mobile-compatible review
path and the additional task types requested, and expands the plan to explicitly treat "the
underlying Sefaria data can shift" as a first-class, cascading concern rather than a per-artifact
afterthought.

Decisions already made for this plan (confirmed with the user):
- **Trigger model**: scheduled runs, but the schedule is human-driven — the user edits a small
  budget/schedule config to enable task types, set caps, and pause/resume, rather than either a
  blind fixed cron or a fully manual invocation every time.
- **First task type to harden**: Rashi/Tosafot translation — already prototyped and
  quality-validated by real runs in PR #54; re-platforming it onto the new context/budget design
  first proves the new architecture on a task already known to produce good output.
- **Review surface**: split by judgment level — mechanical task types go straight to a GitHub PR
  after self-critique. High-judgment/prose task types instead ship as **pending** content directly
  in the repo (not held outside git in a Doc) and are reviewed **in place, on the actual rendered
  page** — the clearest possible preview of how a change will look to real readers — through a new
  admin-only in-page review UI. An Approve/Edit action there creates a **new, attributed PR**
  (username + approval timestamp in the PR, via the GitHub API) carrying that one accepted/edited
  change; Reject records the reason for retry feedback. This was revised from an earlier
  Google-Docs-based design after user feedback — see Section 4.

## Architecture overview

```
 Sefaria API ──(cache_all_api_requests.ts, unchanged)──> cached_outputs/ (gitignored, local)
                                                                │
                                        ┌───────────────────────┘
                                        ▼
                          precomputed/rsi_state/page_skeleton.ts (NEW)
                          builds a compact, per-page structural index:
                          ordered segment refs + short previews + which
                          commentaries exist + comment counts — NOT full text
                                        │
                     ┌──────────────────┴───────────────────┐
                     ▼                                        ▼
          initial prompt (Tier A):                  context_fetch tool (Tier B, NEW):
          - target text                              the ONLY way to get more than the
          - page skeleton                            initial prompt gives — narrow,
          - 1-2 worked examples pulled               ref-addressed, size-capped, and every
            from past accepted generations            call is logged at ref granularity
                     │                                        │
                     └──────────────────┬─────────────────────┘
                                        ▼
                     rsi_orchestrator/headless_claude.ts (existing, reused)
                     `claude -p` — model pinned per task type, allowedTools
                     scoped to ONLY the context_fetch CLI (no raw Read/Grep/Glob
                     over cached_outputs — see "Context" section for why)
                                        │
                                        ▼
                     generate → self-critique → (retry once) → accept/give up
                     (existing generateWithSelfCritique, reused as-is)
                                        │
                     ┌──────────────────┴───────────────────┐
                     ▼                                        ▼
       precomputed/rsi_state/generation_record.ts    precomputed/rsi_state/spend_ledger.jsonl
       (extended: dependsOn now auto-populated        (NEW — every call's cost/model/task type,
        from context_fetch's own request log,          for the status CLI and routing tuner)
        not self-reported)
                                        │
                     ┌──────────────────┴───────────────────┐
                     ▼                                        ▼
          reviewSurface: "github-pr"                reviewSurface: "in-page"
          batch accepted edits → branch             batch candidates as status:"pending" →
          → `gh pr create`                          orchestrator's own low-ceremony PR → user
          (existing pattern, generalized)           merges it (same as any other RSI PR) so
                                                      pending data is live on the deployed site
                                                              │
                                                              ▼
                                                     js/RsiReviewOverlay.tsx (NEW, admin-gated)
                                                     renders each pending suggestion INLINE on
                                                     its real page, in place, with Approve /
                                                     Edit / Reject controls — the actual
                                                     rendering readers would see, not a diff
                                                              │
                                                              ▼
                                            POST /api/rsi-review-decision (NEW, express.ts)
                                            Approve/Edit → GitHub API creates a NEW PR carrying
                                            just that change, with the reviewer's username +
                                            approval timestamp in the PR body/commit — merging
                                            THIS PR is what makes it visible to every reader.
                                            Reject → GitHub issue comment with the reason, read
                                            back by the next scheduled run as retry feedback.
```

Everything below elaborates the pieces marked NEW, and how they change the pieces that already
exist.

## 1. Context: replace "goal + filesystem access" with tiered, ref-addressed, JIT fetching

**What broke:** `rashi_tosafot_translation.ts`'s `generationPrompt()` inlines the target Hebrew
text, then points Claude at `cached_outputs/api_request_handler/<Book>.<page>.json` — a single
file that was 476KB for one real page, of which Mesorat Hashas (a citation index, not prose)
alone was 42% of all commentary bulk — and says "read the surrounding segments... if it would
help... use your own judgment." With `allowedTools: ["Read", "Grep", "Glob"]` unscoped to any
path, the agent doesn't just read that one file — the tool-use log showed it searching unrelated
books (Job, Meilah) for translation style, plus reading the pipeline's own source. The retrospective's
working hypothesis: given raw source text but no example of the *expected output shape and
quality*, Claude goes hunting for calibration instead of answering. This matches the user's own
diagnosis from this conversation: initial prompts should carry minimal text plus a rough
structure, with more fetched only as needed — not "here's a haystack, look if you want."

**Design:**

- **`precomputed/rsi_state/page_skeleton.ts` (NEW).** Given a page's cached JSON, produce a
  compact structure: the ordered list of segment refs, a short preview (first ~8 words) of each,
  and for each segment which commentaries exist and how many comments each has — no full comment
  text. For an average page this is a few hundred tokens, not hundreds of KB. This replaces "here's
  a 476KB file, read what you want" in every task-type prompt.
- **`rsi_orchestrator/context_fetch.ts` + `context_fetch_cli.ts` (NEW).** A narrow, purpose-built
  tool — not generic filesystem access — with a small fixed API: `getRefs(refs[])` (returns
  `{ref, he, en}` for specific segment/comment refs, capped per call so a request for "everything"
  is rejected with a clear error rather than silently served), `getNeighborSegments(ref, before,
  after)`, `getPriorSugyaSkeleton(page, count)`. Exposed to the headless CLI call as the **only**
  tool beyond the initial prompt: `--allowedTools` becomes a single scoped `Bash(node
  rsi_orchestrator/context_fetch_cli.js *)` entry, and **`Read`/`Grep`/`Glob` are removed from the
  default allow-list entirely.** This isn't a permission-string path restriction (which wouldn't
  have prevented the observed wandering, since it was never applied) — it's structural: there is no
  tool that can read an arbitrary file or search across books, so wandering into `Job` or `Meilah`
  becomes impossible rather than merely discouraged. Every call through this tool is logged
  ref-by-ref to `context_usage_log.jsonl` (already exists, reused) — this gives the "learned
  trimming" ambition from the original plan actually clean, structured signal (which context
  categories get requested, at what rate, correlated with critique pass/fail) instead of noisy
  free-text `Read`/`Grep` inputs across unrelated files.
- **Worked examples inline in the prompt.** Each generation prompt pulls 1-2 recent *accepted*
  generations for the same task type + commentator from `generation_record.ts` and inlines
  source+output directly, addressing the retrospective's calibration-hunting hypothesis head-on
  rather than leaving it as an open question. (Falls back to a hand-written example for the very
  first few runs before any generation records exist.)
- **`dependsOn` is now auto-populated by the orchestrator, not self-reported.** Since
  `context_fetch` is the only way to get more context and every request is already logged,
  `dependsOn` for a generation record becomes "primary source ref + every ref requested via
  `context_fetch` during that call" — pulled straight from `context_usage_log`, not trusted to an
  agent-reported field. This closes a real gap in the current code: `rashi_tosafot_translation.ts`
  currently always writes `dependsOn: []`, so the cascading-invalidation design in
  `staleness.ts`/`generation_record.ts` (`findDependentsOnPage`) has never actually had anything to
  cascade through in a real run.

This applies to every task type going forward, not just translation — it's the shared
context-provisioning layer.

## 2. Budget and scheduling: human-driven schedule, call-count ledger, not a dollar cap

**What broke:** no proactive pacing exists; the system finds out it's out of budget by hitting
Claude Code's usage-limit wall (happened 3 times in one real session). `--max-budget-usd` is
unwired, and its own help text ("maximum dollar amount to spend on API calls") makes it unclear
whether it means anything under subscription billing at all.

**Design**, matching the confirmed answer (scheduled, but human-driven):

- **`precomputed/rsi_state/budget.json` (NEW, git-tracked, hand-edited by the user).** Per task
  type: `enabled`, `maxCallsPerRun`, `maxCallsPerDay`, `priority`. Plus a top-level `pausedUntil`
  (ISO timestamp or null) — a one-line edit to fully halt all runs before the user needs their own
  interactive budget for something else. This is the "drive the schedule" surface: no code change
  needed to enable/disable a task type or throttle it, just an edit to this file.
- **`rsi_orchestrator/schedule_runner.ts` (NEW)** — the actual cron/launchd entrypoint (reusing the
  `launchd` pattern already documented in `rsi_orchestrator/README.md`, not yet installed). On each
  scheduled tick it reads `budget.json`, and for each enabled task type under today's cap and not
  paused, runs one bounded batch (small, e.g. capped candidate count per tick — never an open-ended
  run), then stops. Frequent small ticks (e.g. every 30-60 min) rather than one long run, so a
  `pausedUntil` edit takes effect quickly and a rate-limit hit only costs one tick's worth of
  wasted wall-clock, not a whole session.
- **`precomputed/rsi_state/spend_ledger.jsonl` (NEW, git-tracked, append-only)** — one line per
  call: `{taskType, callKind, model, costUsd, ref, timestamp}`, reusing the `costUsd` already
  captured by `headless_claude.ts`. Not used for enforcement (dollar meaning under subscription
  billing is unverified, per the retrospective) — used for **visibility**, which is what the user
  actually asked for ("I want to have control... though often I have sufficient budget left over
  and it's a shame for it to go to waste").
- **`rsi_orchestrator/status_cli.ts` (NEW, `npm run rsi:status`)** — prints today's/this-week's call
  counts and observed `costUsd` per task type against `budget.json`'s caps, and whether anything is
  currently paused. This plus `budget.json` together are the full "control panel": check status,
  edit the config, done — no dashboard UI needed.
- Enforcement itself stays call-count-based (already fully within this code's control), not
  dollar-based (not verified to be meaningful) — this sidesteps open question #7 from the
  retrospective rather than resolving it: track dollars for visibility, throttle on call counts.

## 3. Model routing

Keep the plan's original shape (per-task-type config, tuned later from logged outcomes via a
periodic "routing tuner"), but fix the concrete gap the retrospective found: `--model` must always
be passed explicitly (already fixed in PR #54's `headless_claude.ts` — keep this), and
`spend_ledger.jsonl` plus `generation_record.ts`'s existing `model`/`costUsd` fields are the input
a later `rsi_orchestrator/tune_routing.ts` (Phase 4, not built yet) reads to propose per-task-type
model changes. Starting point for Phase 1/2: `precomputed/rsi_state/model_routing.json` (NEW),
one entry per task type (`model` for generate, `model` for critique — these can differ, since
critique is a narrower/more mechanical check than generation). Initial values are a judgment call
per task type's actual difficulty (translation generation: Sonnet; translation critique: can likely
be cheaper — this is exactly the kind of thing the tuner should verify once there's enough logged
data, not something to hand-tune indefinitely).

## 4. Review surface: split by judgment level, high-judgment content reviewed in place

- **Mechanical task types** (`reviewSurface: "github-pr"` in the task-type config) — unchanged from
  today's pattern: self-critique passes → batch accepted edits onto a branch → `gh pr create`.
- **High-judgment/prose task types** (`reviewSurface: "in-page"`) — this was originally designed
  around a Google Docs review surface; revised after feedback: reviewing a prose change is most
  honest when seen exactly as a real reader would see it — inline, in place, on the actual page —
  not as a JSON diff or a Doc comment thread. New path, no Google Docs/OAuth work needed at all:
  1. **Candidates ship as `status: "pending"` directly in the repo.** Extend
     `precomputed/ai_additions/<Book Page>.json` (and the merge logic in `api_request_handler.ts`'s
     `addAiAdditions()`) with a status field. The orchestrator's scheduled batch for these task
     types opens its own low-ceremony PR (same `gh pr create` mechanism as the mechanical path) —
     the user still merges it, same as any RSI PR today, which is what makes the pending data live
     on the deployed site. Pending items are otherwise inert: never shown to normal readers.
  2. **`js/RsiReviewOverlay.tsx` (NEW).** Admin-only (same gating pattern already used for
     `RsiSuggestionBox.tsx`, e.g. `!isFake`/an owner check — never shown to regular visitors).
     Renders each pending suggestion **inline, at its real position on the real page**, styled
     distinctly (e.g. a "pending AI suggestion" outline/badge), with Approve / Edit / Reject
     controls right there. This is the actual point of the redesign: what you see while reviewing
     is pixel-for-pixel what a reader would see if you approve it, not an abstraction of it.
  3. **`POST /api/rsi-review-decision` (NEW, `express.ts`, same shape as the existing
     `/api/suggest-rsi-task` and `/corrections` endpoints — those already establish the "browser
     can't write to git, so call out to the GitHub API with a server-held token" pattern this
     reuses).**
     - **Approve** or **Edit** → creates a **new PR** via the GitHub API containing just that one
       change (the generated text, or the user's edited text if they edited it in the overlay
       first), with the reviewer's username and an approval timestamp recorded in the commit
       message/PR body — per the user's explicit choice, this is the durable "stamp of approval."
       **Merging this PR is the actual promotion step** that flips the item from pending to live
       for every reader — review and shipping are the same action, from any device, since GitHub's
       own mobile app/API access works from a phone.
     - **Reject** → no PR (nothing to ship); records the reason as a GitHub issue comment (reusing
       the existing suggestion-box/triage_log pattern), read back by the next scheduled run as
       `generateWithSelfCritique`'s existing `priorFeedback` input — reuse, not a new mechanism.
  - Net effect: no new auth system, no Google Docs integration work at all for this path — it
    reuses exactly the one server-side credential pattern (`GITHUB_ISSUE_TOKEN`-style token) already
    proven in this codebase for "the deployed app needs to durably record something but has no DB."
    Works identically whether reviewing from the live site on a phone or from a desktop.

## 5. Staleness detection: keep, extend one gap

The tiered detector (`precomputed/rsi_state/staleness.ts`) — Tier 0 fingerprint hash, Tier 1
edit-distance ratio, Tier 2 agentic classification hook, Tier 3 structural break — is solid,
already unit-tested, and already validated against real generation records. Keep it as-is. Two
extensions:

- **Cascading invalidation now actually cascades**, because `dependsOn` is populated (see
  Section 1) instead of always empty. A Tier 3 hit on a ref walks `findDependentsOnPage` and
  correctly marks dependents stale — this is the concrete mechanism for "a segmentation-boundary
  fix invalidates downstream Rashi translations" that the original plan described but the real
  implementation never wired up.
- **The segmentation-boundary audit task type (Section 6) is explicitly upstream** of every other
  task type in scheduling priority — its accepted suggestions are the highest-value trigger for
  cascading invalidation, so it should run (and its results be reviewed/applied) before other task
  types regenerate against a page, not interleaved arbitrarily.

## 6. Task types and phasing

**Phase 1 — re-platform the validated task type onto the new architecture** (confirmed first
priority): rebuild `rashi_tosafot_translation.ts`'s prompt construction on `page_skeleton.ts` +
`context_fetch`, remove `Read`/`Grep`/`Glob` from its allowed tools, add worked-example inlining,
wire real `dependsOn`, add `model_routing.json` + `budget.json` + `spend_ledger.jsonl` +
`status_cli.ts` + `schedule_runner.ts`. Ship on the existing `reviewSurface: "github-pr"` path
first (it's already proven), defer the in-page review path to Phase 3 rather than blocking
Phase 1 on it.

**Phase 2 — segmentation-boundary audit (NEW task type).** Detects poorly-split Sefaria segments
(the "Rashi comment that's really two comments" case) and suggests better boundaries, using
`precomputed/segmentsPerPage.json` history plus the page skeleton to reason about segment
coherence. Highest-judgment task type built so far — a good first candidate for the in-page
review path (Phase 3, see below) once that exists, but can ship its first version through GitHub
PR review like everything else meanwhile. Its accepted suggestions are what Section 5's cascading
invalidation is for.

**Phase 3 — in-page review path** (`ai_additions` pending-status support, `RsiReviewOverlay.tsx`,
`/api/rsi-review-decision`), applied first to segmentation-audit and translation output, since
those are the prose/judgment-heavy cases the split was designed for.

**Phase 4 — model-routing tuner + remaining task types**, roughly in this order (cheapest/most
bounded first, to build up logged data before spending real budget on harder ones):

1. **Vilna-vs-Sefaria variation significance classifier** — upgrades the current strict-equality
   check (`isUniqueHebrew` in `api_request_handler.ts`) to distinguish spelling/niqqud variants
   from substantively different text. Small, bounded scope (compare two known texts, classify) —
   good pilot for the routing tuner once there's a second task type's data to compare against the
   first.
2. **Modern unit/measurement explanations** as synthetic comments — reuses the same
   `"Versions"`/`AI Edit`-comment merge mechanism, gated to only fire when a weight/measure term
   relevant to the sugya's halachic outcome appears (not every incidental mention).
3. **Sugya-understanding tables** as synthetic comments — the first task type whose output isn't a
   single-segment Hebrew/English replacement, so it needs a new comment kind (structured table
   markup) alongside `"AI Edit"` in the merge mechanism, as the original plan anticipated.
4. **Steinsaltz bold/italic formatting fixes** — blocked on finding a concrete example of the bug
   first (none found anywhere in the repo across all three research passes for this plan); don't
   scope further until one exists.
5. Remaining "additional ideas" from the original plan doc, lowest priority: cross-reference
   discovery, Amora/Rishon bio notes, machloket position maps, Rashi-vs-Tosafot disagreement
   flagging.

## New task-type ideas (beyond the original list)

- **Consistency auditor** — doesn't generate new content; periodically scans already-shipped AI
  content across the corpus for inconsistency (same term translated differently in different
  places, punctuation-style drift between pages generated months apart under different prompt
  versions). This is the part of "recursive self-improvement" that watches the system's own output
  quality over time, not just source-data drift — feeds findings into the existing suggestion-box
  triage pathway (`rsi_orchestrator/triage_suggestions.ts`) as self-generated suggestions.
- **Cross-translation conflict check** — flags places where a newly-generated Rashi/Tosafot
  translation seems to conflict with the base Gemara's already-published English (Steinsaltz/Koren)
  in a way that suggests a subtle mistranslation. A QA signal specific to the fact that Rashi/Tosafot
  are being translated for the first time here, while the base text's translation is already
  Sefaria-vetted.
- **Corpus-level English search index (NEW: a "meta" task type)** — every other task type above
  operates per-page; this one is a periodic aggregate job producing a searchable English
  index/glossary across all newly-translated Rashi/Tosafot content, since that text was previously
  Hebrew-only and unsearchable in English. Worth scoping once enough pages have translations to
  make an index meaningful.
- **Sugya roadmap comment** — distinct from the table-generation idea: a short synthetic
  "shape of the argument" comment at the start of a sugya (how many questions, how many
  resolutions, where the pivot points are), aimed at orientation before reading rather than
  summarizing conclusions.

## Critical files

**Reused as-is:** `rsi_orchestrator/headless_claude.ts` (model pinning, cost/tool-use capture,
rate-limit error handling — all validated by real runs), `precomputed/rsi_state/staleness.ts`,
`precomputed/rsi_state/generation_record.ts` (schema extended, not replaced),
`precomputed/rsi_state/triage_log.ts`, `js/promote_replaceable_ai_comments.ts`, and the
`GITHUB_ISSUE_TOKEN`-based GitHub REST API call pattern already in `express.ts` (~line 645,
`/api/suggest-rsi-task`) — the direct template for the new `/api/rsi-review-decision` endpoint.

**Rewritten:** `rsi_orchestrator/rashi_tosafot_translation.ts` (`generationPrompt()` rebuilt around
skeleton + context_fetch instead of the raw cached-file pointer; `dependsOn` wiring).
`precomputed/ai_edits.ts` / `ai_edits_indexer.ts` and `api_request_handler.ts`'s `addAiAdditions()`
(add a `status: "pending" | "approved"` field; expose pending items only to an admin-gated request).

**New:** `precomputed/rsi_state/page_skeleton.ts`, `rsi_orchestrator/context_fetch.ts` +
`context_fetch_cli.ts`, `precomputed/rsi_state/budget.json` + a small reader module,
`precomputed/rsi_state/spend_ledger.jsonl` + writer, `rsi_orchestrator/schedule_runner.ts`,
`rsi_orchestrator/status_cli.ts`, `precomputed/rsi_state/model_routing.json` + reader,
`js/RsiReviewOverlay.tsx`, `express.ts`'s new `/api/rsi-review-decision` endpoint,
`rsi_orchestrator/segmentation_audit.ts` (Phase 2).

## Verification

- Unit tests follow the existing pattern throughout this codebase: dependency-injected fakes for
  `runHeadlessClaude`/`context_fetch`/the GitHub API calls, no real API calls in the test suite
  (matches current `*.test.ts` files alongside each module).
- Given the retrospective's finding #4 (every real bug so far was found by *running* the pipeline,
  not by the mocked test suite — including one that deleted real log data via a hardcoded
  production path in a test's `fs.rmSync` cleanup) — add a cheap, safe integration check as part of
  this redesign: a small real (but `--dry-run`/no-write) invocation of `schedule_runner.ts` against
  a single known page, run manually before each phase ships, specifically to catch the class of
  bug that only appears under `ts-node` (not `babel-jest`) — per retrospective finding #3, this
  codebase's TS-target divergence between its two toolchains is a standing risk worth a real
  end-to-end smoke check, not just more unit tests.
- For Phase 1 specifically: re-run against the same real page already exercised in PR #54
  (Menachot 80a) and compare `context_usage_log` before/after — the concrete, checkable claim of
  this redesign is that the same task, on the same page, no longer wanders into unrelated books and
  costs materially less per candidate.
- For the in-page review path (Phase 3): manually verify round-trip on one real page — merge an
  orchestrator PR with a `status: "pending"` candidate, confirm `RsiReviewOverlay.tsx` renders it
  inline (admin-only — verify it's invisible to a non-admin request), Approve/Edit it from a phone,
  confirm `/api/rsi-review-decision` opens a correctly-attributed PR, and that merging it flips the
  content to visible for everyone; separately verify Reject produces the GitHub issue comment and
  that the next scheduled run picks it up as retry feedback.
