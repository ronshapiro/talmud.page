# RSI orchestrator (Phase 1 scaffolding)

Self-hosted scripts for the recursive self-improving content agent — see
`RecursiveSelfImprovingAgentPlan.md` at the repo root for the full plan. These run on this
machine (not a separate server, not Managed Agents), authenticated the same way interactive
Claude Code already is here, so usage draws on the existing subscription rather than metered API
billing.

## What's here today

- `headless_claude.ts` — thin wrapper around `claude -p` (headless Claude Code). Exported as an
  injectable function so callers can substitute a fake in tests.
- `triage_suggestions.ts` — reads open `rsi-suggestion`-labeled GitHub issues (filed via the
  suggestion box in the app UI), has Claude assess each one's feasibility against the current
  codebase, and posts that assessment as an issue comment. **It stops there** — it does not yet
  scaffold a new task type or open a PR. That auto-implement step needs Phase 2's task-type config
  format to exist first; building it now would have nothing real to scaffold against. Until then,
  this gives you a triaged, annotated backlog to act on manually.
- `precomputed/rsi_state/triage_log.json` (created on first run) — tracks which issue numbers have
  already been triaged, so re-running doesn't re-comment on the same issue.

Not here yet: the actual content-generation task types (Phase 2), and anything that pushes a
branch or opens a PR — those come once Phase 2 exists.

## Running manually

```sh
npx ts-node rsi_orchestrator/triage_suggestions.ts
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
