# RSI orchestrator

Self-hosted scripts for the recursive self-improving content agent — see
`RecursiveSelfImprovingAgentPlan.md` at the repo root for the full plan. These run on this
machine (not a separate server, not Managed Agents), authenticated the same way interactive
Claude Code already is here, so usage draws on the existing subscription rather than metered API
billing.

## What's here today

- `headless_claude.ts` — thin wrapper around `claude -p --output-format json` (headless Claude
  Code). Exported as an injectable function so callers can substitute a fake in tests. Returns the
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
  asks Claude to punctuate and translate it — pointing at where the page's cached data and sugya
  boundaries live in the repo rather than pre-assembling context itself, so the model decides how
  much it needs to read — then runs a bounded self-critique pass (generate → critique → at most
  one retry with feedback → give up) before writing to `precomputed/ai_additions/<Book Page>.json`
  and recording a generation record. Requires `cached_outputs/api_request_handler/` to be
  populated for that book first (`npx ts-node cache_all_api_requests.ts`).
- `rashi_tosafot_translation_cli.ts` — the CLI entrypoint for the above, kept in a separate file
  because `yargs` is ESM-only and breaks under jest; the core module stays importable by its test
  file this way. `--section`/`--limit` bound a run to one page / a handful of candidates.
- `precomputed/rsi_state/triage_log.json` (created on first run) — tracks which issue numbers have
  already been triaged, so re-running doesn't re-comment on the same issue.

## Running manually

```sh
npx ts-node rsi_orchestrator/triage_suggestions.ts
npx ts-node rsi_orchestrator/rashi_tosafot_translation_cli.ts Zevachim --section 2a --limit 2
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
