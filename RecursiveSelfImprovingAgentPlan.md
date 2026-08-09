# Recursive self-improving content agent — plan

A system that generates and maintains derived Talmud-page content (translations, tables,
annotations, formatting fixes) beyond the current Gemini-based Rashi/Tosafot pipeline, running
mostly unattended, detecting when Sefaria's underlying data shifts out from under its own output,
and improving its own prompting/context/model choices over time from logged outcomes.

## Execution substrate: self-hosted, on your existing subscription — not Managed Agents

Managed Agents (Anthropic's hosted agent platform) was the original candidate — it supplies both
the agent loop and managed deployment for free (cron, sandboxed sessions, memory stores, GitHub
PR support). But it bills as metered API usage, a separate cost commitment from your Claude Code
subscription — ruled out. The requirement is: runs on infrastructure you control, and draws from
the same subscription/login you already use for Claude Code, even though that makes budget
tracking cruder.

That points to the **Claude Code CLI itself, run headlessly** (`claude -p ...`) from an
orchestrator process on a machine you control — not your laptop, since scheduled jobs need
something always-on (a small VPS, mini PC, or similar). It inherits whatever auth Claude Code
already has configured, so usage draws from the same plan as your interactive sessions — no API
key, no Console spend cap. The Claude Agent SDK is a plausible later upgrade if finer-grained tool
permissions are needed, but whether it shares subscription billing the same way as the CLI isn't
confirmed — start with the CLI, since that's certain.

Consequences of self-hosting instead of Managed Agents:

- **Content that ships** stays git-committed, reviewed via PR — unchanged.
- **Operational state** (dependency/staleness generation records, model-routing stats,
  context-usage logs, staleness-detector calibration data) lives in git-tracked JSON/JSONL files
  (e.g. under a new `precomputed/rsi_state/`), not a memory store. Diffable, and backed up simply
  by being committed — a private repo is enough.
- **Each task type is its own versioned config file** (model, effort, system prompt) rather than
  a Managed Agents `Agent` object — git history is the version/rollback mechanism, arguably more
  inspectable than an API-managed version.
- **Scheduling** is cron / systemd timers / launchd on whatever machine hosts this.
- **Review** — the orchestrator has its own git checkout and credentials, so it just runs
  `gh pr create` directly; no vault/credential abstraction needed.
- **Self-critique before human review** is hand-rolled (a second, often cheaper, model call
  checking the candidate against its source) rather than Managed Agents' rubric-graded Outcomes
  API — a bounded loop of a couple of Messages API calls, not a big loss.

### Budget

No dollar ledger — Claude Code subscription usage isn't metered that way. The practical controls
are: Claude Code's own usage-limit errors as the hard stop, and self-imposed pacing (a cap on
sessions per day per task type, running only during off-hours, priority ordering so this doesn't
starve your other Claude Code work on a heavy day). This is coarser than a spend cap by design —
accepted in exchange for staying on the existing subscription.

## Data flow

- **Tier 0 — source of truth**: Sefaria's API, pulled offline into `cached_outputs/` (unchanged).
- **Tier 1 — shipped derived content**: git-committed JSON under `precomputed/`, same shape as the
  existing `ai_additions/<Book Page>.json` + synthetic-`"Versions"`-comment merge mechanism in
  `api_request_handler.ts` / `promote_replaceable_ai_comments.ts`. New task types add new
  comment kinds alongside the existing `"AI Edit"`, since most of them (tables, unit
  conversions) aren't a single-segment Hebrew/English replacement.
- **Tier 2 — operational state**: git-tracked JSON/JSONL under `precomputed/rsi_state/`. Holds:
  - a generation record per generated artifact: `{sourceRefs, sourceText, model, promptVersion,
    generatedAt, dependsOn[], confidence}`
  - staleness-detector calibration data (edit-distance ratios vs. agentic verdicts)
  - per-(task type, model) acceptance-rate / edit-distance-from-final stats
  - per-task-type context-usage logs (what the agent chose to read, and whether it helped)
- **Review surface**: the orchestrator (running with your own git/GitHub credentials on its host
  machine) pushes a branch and runs `gh pr create` directly. Reviewed via the GitHub mobile app.
  Whether prose-heavy content (translations) is better reviewed via Google Docs instead of a raw
  JSON diff is an open question for Phase 3, not decided yet.
- **New user-facing feature — suggest a task type**: a small UI element (e.g. in `Preferences.tsx`
  or a lightweight feedback widget) posts free text to a new `express.ts` endpoint, which creates
  a GitHub issue labeled `rsi-suggestion` via the GitHub REST API. A cron-scheduled "triage" run
  periodically reads open issues with that label, evaluates feasibility against existing task
  types and data availability, and — if viable — scaffolds a new task-type config and opens a PR
  implementing it. This is the literal recursive-self-improvement loop: the system extends its
  own capability set from user input, gated by your PR approval.

## Staleness detection (tiered, self-tuning)

Generalizes two things that already exist: `isUniqueHebrew`/`normalizeHebrewForVersionUniqueness`
(exact match after stripping punctuation/niqqud, used for the Vilna diff) and the loose matcher in
`matching.ts` (tolerant highlight re-anchoring).

- **Tier 0 — fingerprint**: every generated artifact stores a normalized-text hash of its source
  ref(s). Match on rebuild → serve as-is.
- **Tier 1 — edit distance (new)**: on mismatch, compute a cheap edit-distance ratio between old
  and new source text (not niqqud/punctuation-stripped this time — the point is to *measure* how
  much changed, not hide it). Below a small threshold → auto-classify as cosmetic
  (punctuation/spacing/niqqud drift), keep serving, no model call.
- **Tier 2 — agentic classification (new, only for the ambiguous band)**: ratio between
  "clearly cosmetic" and "clearly rewritten" escalates to an actual Claude call — one of the
  task-type agents — that's shown the old text, the new text, and the dependent artifact, and
  judges whether the artifact is still valid. Its verdict is logged alongside the generation
  record so the thresholds below can be retuned from it later.
- **Tier 3 — structural break**: above the upper threshold (or a segment-count change, cheaply
  detectable via `precomputed/segmentsPerPage.json` — exactly the "Rashi comment got split in
  two" case) → the artifact is suppressed and requeued for regeneration without asking.
- **Self-tuning**: the logged Tier 2 verdicts are periodically reviewed to retune the Tier 1
  thresholds — literal recursive self-improvement of the staleness detector itself.
- **Cascading invalidation**: each artifact's generation record declares `dependsOn`; a Tier 3 hit
  on a ref walks the generation records for dependents and marks them stale too (this is how a
  segmentation-boundary fix invalidates downstream Rashi translations).

## Generation pipeline (fully agentic — no hand-crafted prompts)

The existing Gemini pipeline (`precomputed/sugya_prompt_client.ts`) is retired entirely, not
ported. Its replacement gives each task-type agent a **goal and tools**, not a scripted
context-assembly function:

- Read/Grep access to the repo's Sefaria cache and precomputed indices — the agent decides what
  context it needs (prior sugya, commentaries, parallel Mishnah) rather than a hand-tuned
  pipeline deciding for it.
- What it chose to read (and the eventual acceptance/edit-distance outcome) is logged to
  `precomputed/rsi_state/` per task type, so the *system* learns each task type's typical context
  needs over time instead of you hand-tuning it once.
- A cheap self-critique pass (a smaller/cheaper model checking the candidate against its source)
  runs before anything reaches human review, to keep the review queue signal-heavy — a bounded
  loop of a couple of extra calls, hand-rolled rather than a platform feature.
- Output still lands in the existing `precomputed/ai_additions/<Book Page>.json` shape and merge
  mechanism — that plumbing already works and doesn't need to change.

## Model routing (learned, not fixed)

Each task type's `model`/`effort` lives in its own versioned config file, with git history as the
audit/rollback trail. A periodic "routing tuner" run reads the logged per-(task type, model)
acceptance-rate and edit-distance stats and proposes an updated config — e.g. downgrading a task
type that a cheaper model already handles well, or upgrading one where quality is the bottleneck.
This is the concrete mechanism behind "learn which models to use for which tasks."

## Task types

**From your list:**
- Translate + punctuate all Rashi/Tosafot comments (replaces the Gemini pipeline)
- Vilna-vs-Sefaria variation significance classifier — upgrades the current strict-equality check
  (`isUniqueHebrew`) to distinguish spelling/niqqud variants from substantively different text
- Sugya-understanding tables, embedded as synthetic comments
- Modern unit/measurement explanations, embedded as synthetic comments
- Steinsaltz bold/italic formatting fixes (note: no existing bug reports found in the repo for
  this — worth a concrete example before scoping the task type)

**Dropped per your feedback:** terminology glossary linking (Steinsaltz already covers it),
halachic-conclusion summary (already covered by the linked explicit segments).

**Additional ideas:**
- Cross-reference discovery — implicit connections to other sugyot/Mishnayot not in Sefaria's
  link data, surfaced as "See also" synthetic comments
- Amora/Rishon bio notes — first-mention-per-page synthetic bio comment, same shape as the
  existing `tanakh_contexts` precedent but for people
- Machloket position map — compact structured "who holds what, based on what" table for sugyot
  with multiple disputants; a more constrained sibling of the general table-generation task
- Rashi-vs-Tosafot disagreement flagging — since both are already being translated, detect
  explicit disputes and generate a side-by-side comparison comment

## Phasing

1. **Foundations** — orchestrator scaffolding on a self-hosted always-on machine (headless
   `claude -p` invocation, cron/systemd scheduling, GitHub credentials for `gh pr create`), the
   tiered staleness detector (Tiers 0–3), the generation-record/dependency-graph schema in
   `precomputed/rsi_state/`, and the suggestion-box UI + GitHub-issue endpoint + triage-run
   skeleton.
2. **Rewrite the generation pipeline** — retire the Gemini pipeline entirely; stand up the fully
   agentic Rashi/Tosafot translation task, goal-plus-tools rather than a hand-built prompt/context
   pipeline, output into the existing `ai_additions` merge mechanism.
3. **Human review loop** — the highest-judgment task types first (sugya tables, segmentation-
   boundary suggestions), not the mechanical ones — this is the part worth proving the whole
   project on. Decide GitHub-PR-review vs. Google-Docs-review per task type based on how well a
   JSON diff conveys prose quality.
4. **Budget pacing + model-routing feedback loop** — self-imposed session pacing per task type
   (no dollar ledger, since this runs on subscription usage); the routing-tuner run described
   above, once there's enough logged usage to make it meaningful.
5. **Broader rollout** — remaining task types from the list above, plus whatever the triage run
   has scaffolded from user-submitted suggestions by this point.

## Open questions

- Where this actually runs — needs an always-on machine you control (not a laptop that sleeps);
  worth deciding what that is before Phase 1.
- Whether the Claude Agent SDK is worth adopting later for finer tool-permission control, and
  whether it shares subscription billing the same way the CLI does — unconfirmed, so start with
  headless `claude -p` and revisit.
- Google Docs vs. GitHub PR as the primary review surface for prose-heavy content — decide in
  Phase 3, not now.
- Concrete example(s) of the Steinsaltz bold/italic bug before scoping that task type — none
  found in code comments, TODOs, or git history during initial research.
