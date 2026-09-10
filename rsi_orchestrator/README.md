# RSI orchestrator

Self-hosted scripts for the recursive self-improving content agent — see
`RecursiveSelfImprovingAgentPlan.md` at the repo root for the full plan. These run on this
machine (not a separate server, not Managed Agents), authenticated the same way interactive
Claude Code already is here, so usage draws on the existing subscription rather than metered API
billing.

## What's here today

- `agent_runner.ts` — headless agent runner interface wrapping `claude` (`claude -p`) and `agy`
  (`agy -p`). Exported as an injectable function so callers can substitute a fake in tests. Returns the
  response text plus the canonical model ID and cost the CLI reports, so generation records can
  capture what actually ran (needed for Phase 4's model-routing learning).
- `triage_suggestions.ts` — reads open `rsi-suggestion`-labeled GitHub issues (filed via the
  suggestion box in the app UI), has Claude assess each one's feasibility against the current
  codebase, and posts that assessment as an issue comment. **It stops there** — it does not yet
  scaffold a new task type or open a PR. That auto-implement step needs a settled task-type config
  format across more than one task type first; building it now would have nothing real to
  scaffold against. Until then, this gives you a triaged, annotated backlog to act on manually.
- `rashi_tosafot_translation.ts` — the first content-generation task type, replacing
  `precomputed/sugya_prompt_client.ts` (Gemini-based; left in place, unused, not deleted). For a
  given book, finds Rashi/Tosafot comments that are missing a translation or whose source text has
  drifted (via `precomputed/rsi_state/staleness.ts` + `generation_record.ts`), and for each one:
  asks Claude to punctuate and translate it, then runs a bounded self-critique pass (generate →
  critique → at most one retry with feedback → give up) before writing to
  `precomputed/ai_additions/<Book Page>.json` and recording a generation record. Requires
  `cached_outputs/api_request_handler/` to be populated for that book first
  (`npx ts-node cache_all_api_requests.ts`).
- `context_fetch.ts` + `context_fetch_cli.ts` — the only tool a task-type headless call may use
  beyond its initial prompt (a compact page skeleton — see `page_skeleton.ts` — plus the target
  text and worked examples). Narrow and ref-addressed on purpose: an earlier version pointed
  Claude at the raw cached page file and general `Read`/`Grep`/`Glob` access, which real runs
  showed leads to expensive wandering across unrelated books looking for calibration examples
  (see `RSIAgentDesignRetrospective.md`). `context_fetch_cli.ts get-refs '["ref", ...]'` /
  `get-neighbors <ref>` / `get-prior-sugyot <ref>` are size-capped and log exactly which refs were
  requested — that log is what auto-populates a generation record's `dependsOn` (see
  `extractRequestedRefs`), rather than relying on the model to self-report it.
- `rashi_tosafot_translation_cli.ts` — the CLI entrypoint for the above, kept in a separate file
  because `yargs` is ESM-only and breaks under jest; the core module stays importable by its test
  file this way. `--section`/`--limit` bound a run to one page / a handful of candidates. Supports
  a continuous mode (`--continuous`, `--duration-hours 24`) that runs as much as possible, pausing
  and checking hourly when quota is exhausted and resuming when available.
- `precomputed/rsi_state/triage_log.json` (created on first run) — tracks which issue numbers have
  already been triaged, so re-running doesn't re-comment on the same issue.
- `precomputed/rsi_state/model_routing.ts` + `model_routing_config.json` — per-task-type model
  choice (`generateModel`/`critiqueModel`), read instead of a hardcoded constant so a future
  routing tuner (Phase 4 — not built yet) can propose changes here from logged outcomes. A task
  type with no entry throws rather than silently falling back to a default — uncontrolled model
  selection is exactly what went unnoticed in PR #54's real runs until someone happened to inspect
  a generation record. Note the config file is named `model_routing_config.json`, not
  `model_routing.json` — sharing a basename with the `.ts` module makes Node's extensionless
  `require`/`import` resolve to the `.json` file instead of the module, silently shadowing every
  export (hit this for real while building it).
- `precomputed/rsi_state/budget.ts` + `budget_config.json` — the human-driven schedule: per task
  type, `enabled`/`maxCallsPerRun`/`maxCallsPerDay`/`priority`, plus a top-level `pausedUntil`
  kill switch. Hand-edit this file to turn a task type on/off or change its caps — no code change
  needed. Ships with every task type `enabled: false`, matching the "not wired in on purpose until
  you deliberately turn it on" stance below.
- `status_cli.ts` (`npx ts-node rsi_orchestrator/status_cli.ts`) — the read side of the budget
  loop: today's/this week's call counts and cost per task type against `budget_config.json`'s
  caps, and whether anything is currently paused. Check this before enabling a task type, raising
  a cap, or pausing everything ahead of unrelated Claude Code work.
- `schedule_runner.ts` — the actual scheduled-run entrypoint. Each invocation ("tick") reads
  `budget_config.json`, and for every enabled/under-cap/unpaused task type runs one bounded batch
  (capped by `maxCallsPerRun` and the remaining daily budget), then stops — never an open-ended
  run. See "Scheduling" below for wiring this into launchd.

- **In-page review (Phase 3, translation only)** — `rashi_tosafot_translation.ts` now writes every
  generated candidate with `status: "pending"` (see `precomputed/ai_edits.ts`) instead of shipping
  it live. Pending content still renders to every site visitor, badged as pending — only the
  approve/edit/reject action is gated. A reviewer visits any page with `?rsiReviewKey=<secret>`
  once; the client persists it (`js/rsiReviewKey.ts`) and shows Approve/Edit/Reject controls
  (`js/RsiReviewControls.tsx`) on every pending comment from then on. Those controls call
  `POST /api/rsi-review-decision` (`express.ts`), which checks the key against `RSI_REVIEW_KEY`
  and opens a PR via the GitHub REST API (`rsi_review_pr.ts` — no git checkout needed; see that
  file for how). Decisions batch **per reviewer**: each browser remembers its own last-known-open
  PR number (`rsiReviewPrNumberPreference`) and sends it along as `knownPrNumber`; the server
  reuses that specific PR (if still open) rather than opening a new one per click, but two
  reviewers batching at the same time never share a branch, since each only ever reuses a PR it
  was itself handed back. Merging a PR is what closes that reviewer's current batch; their next
  decision after that starts a fresh one. A reviewer also enters a name/email once
  (`rsiReviewerIdentityPreference`, prompted via a modal on first use), included in every
  PR/commit this flow creates for attribution — self-reported, not verified, since this codebase
  has no login system. **Requires two env vars set in the deployment environment**, neither
  committed anywhere: `GITHUB_ISSUE_TOKEN` (already required above, `repo`-scoped) and
  `RSI_REVIEW_KEY` (a secret string of your choosing — this is the value you put in the
  `?rsiReviewKey=` link). Segmentation-audit review (writing to
  `precomputed/segmentation_overrides.ts` instead of `ai_edits.ts`) is a deliberate fast-follow,
  not built yet — see the RSI Phase 3 plan.

## Running manually

```sh
npx ts-node rsi_orchestrator/triage_suggestions.ts
npx ts-node rsi_orchestrator/rashi_tosafot_translation_cli.ts Zevachim --section 2a --limit 2
npx ts-node rsi_orchestrator/rashi_tosafot_translation_cli.ts --continuous --duration-hours 24
npx ts-node rsi_orchestrator/status_cli.ts
npx ts-node rsi_orchestrator/schedule_runner.ts   # honors budget_config.json — no-ops if nothing
                                                   # is enabled/unpaused/under its daily cap
```

Requires the `gh` CLI authenticated with access to `ronshapiro/talmud.page` (already true on this
machine) and the `claude` CLI logged in (already true, since this reuses that login).

## Scheduling (not installed — do this deliberately)

This is not wired into cron/launchd yet on purpose: it's the kind of thing that should be turned
on deliberately, since it'll consume Claude usage and post to GitHub on a recurring, unattended
schedule. macOS launchd (not cron) is the right tool here — it survives sleep/wake better and
doesn't silently no-op if the machine was asleep at the scheduled time the way cron can. Example
plist for a daily run at 3am, once you're ready to turn it on:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>page.talmud.rsi-triage</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/ronsh/.nvm/versions/node/v24.18.1/bin/npx</string>
    <string>ts-node</string>
    <string>rsi_orchestrator/triage_suggestions.ts</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/ronsh/talmud.page</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/Users/ronsh/.nvm/versions/node/v24.18.1/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>3</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/rsi-triage.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/rsi-triage.log</string>
</dict>
</plist>
```

To install: save as `~/Library/LaunchAgents/page.talmud.rsi-triage.plist`, then
`launchctl load ~/Library/LaunchAgents/page.talmud.rsi-triage.plist`. `WorkingDirectory` and the
`node`/`npx` path should point at wherever the real (non-worktree) checkout of this repo lives on
this machine — adjust before installing.

For content generation, the equivalent plist would point `ProgramArguments` at
`rsi_orchestrator/schedule_runner.ts` instead, on a more frequent interval (e.g. every 30–60
minutes, not once a day — see `schedule_runner.ts`'s module doc for why short ticks are
deliberate). Unlike the triage plist, this one is safe to install even before you're ready to use
it: `budget_config.json` ships with every task type `enabled: false`, so a scheduled tick is a
no-op until you hand-edit that file to turn one on.
