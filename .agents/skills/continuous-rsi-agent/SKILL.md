---
name: continuous-rsi-agent
description: Runbook for starting and running continuous RSI (Recursive Self-Improving) Rashi and Tosafot translation in talmud.page.
metadata:
  version: 1.0.0
---

# Continuous RSI Translation Runbook

Use this skill when asked to run continuous translation for Rashi and Tosafot in `talmud.page`.

## 1. Command Invocation

```bash
npx ts-node rsi_orchestrator/rashi_tosafot_translation_cli.ts <CanonicalBookName> \
  --backend claude \
  --continuous \
  --duration-hours <Hours>
```

### Key Parameters:
- **`<CanonicalBookName>`**: The canonical name from `books.ts` (e.g. `Chullin`, `Menachot`, `all`). Check aliases if unsure (e.g. "Chulin" -> `Chullin`).
- **`--backend`**: `claude` (default for Claude Code CLI) or `agy` (Antigravity CLI).
- **`--continuous`**: Runs continuously for the duration, automatically pausing on quota limits and checking hourly until quota recovers.
- **`--duration-hours`**: Duration for the run (e.g. `18`, `24`, `72`).
- **`--start-page` / `--section`** (optional): Start or bound processing to specific pages (e.g. `--start-page 10b` or `--section 2a`).

## 2. Antigravity Execution Flags

When running from Antigravity:
- **`BypassSandbox: true`**: Required for LLM CLI and GitHub remote operations.
- **`IsDaemon: true`** with `WaitMsBeforeAsync: 8000`: Allows long-running translation to execute in the background without blocking conversation turns.

## 3. Worktree Management & Parallel Runs

- **Direct Commits & PRs**: The translation runner commits and pushes pending candidates directly within its active worktree to its own branch (`git push -u origin HEAD`) and creates/updates a PR for that branch.
- **PR Title Format**: PR titles are formatted as `<task> (<backend>): <pages>` (e.g. `rashi_tosafot_translation (claude): Menachot 90a`), without any `RSI:` prefix. The title dynamically updates as additional pages are committed on the branch.
- **File Change Statistics Comment**: On each commit and push, a markdown comment is automatically posted to the PR containing a rich table with per-file edit modes (`add`, `delete`, `modify`), line addition/deletion counts, and totals.
- **Parallel Safety**: Multiple translation runs for different tractates can run concurrently in separate worktrees without collisions.
- **Cleanup**: Worktrees persist while their PR is open and should be deleted externally only after the PR merges.
