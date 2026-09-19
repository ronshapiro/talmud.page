---
name: continuous-rsi-agent
description: Runbook for starting and running continuous RSI (Recursive Self-Improving) Rashi and Tosafot translation in talmud.page. The only step required is invoking the command.
metadata:
  version: 1.1.0
---

# Continuous RSI Translation Runbook

Use this skill when asked to run continuous translation for Rashi and Tosafot in `talmud.page`.

> [!IMPORTANT]
> The **only step that needs to be done is to invoke the command**. Do not perform any preliminary or manual setup steps — such as looking up canonical book names in `books.ts`, creating git branches, or configuring worktrees. The CLI handles book alias resolution, candidate discovery, translation, commits, pushing, and PR management completely automatically.

## 1. Command Invocation

```bash
npx ts-node rsi_orchestrator/rashi_tosafot_translation_cli.ts <BookName> \
  --backend claude \
  --continuous \
  --duration-hours <Hours>
```

### Key Parameters:
- **`<BookName>`**: Tractate name or alias (e.g. `Chullin`, `Chulin`, `Menachot`, `all`). The CLI looks up book names by alias automatically (e.g. "Chulin" resolves to `Chullin`), so you can pass canonical names or aliases directly without looking them up beforehand.
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
- **Parallel Safety**: Multiple translation runs for different tractates can run concurrently in separate worktrees without collisions.
- **Cleanup**: Worktrees persist while their PR is open and should be deleted externally only after the PR merges.
