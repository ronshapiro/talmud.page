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
  --backend <claude|agy|claude-long-thread|agy-long-thread|ollama> \
  [--model-config <ConfigPreset>] \
  --continuous \
  --duration-hours <Hours>
```

### Key Parameters:
- **`<BookName>`**: Tractate name or alias (e.g. `Chullin`, `Chulin`, `Menachot`, `all`). The CLI looks up book names by alias automatically, so you can pass names directly without looking them up.
- **`--backend`**: `claude` (default for Claude Code CLI), `agy` (Antigravity CLI), `claude-long-thread` (Claude with multi-turn session persistence), `agy-long-thread` (Antigravity with multi-turn session persistence), or `ollama` (local Ollama server).
- **`--model-config`**: Named model preset defined in `model_routing_config.json` under the backend. Specifies the generator and critique model pairing.
- **`--continuous`**: Runs continuously for the duration, automatically pausing on quota limits and checking hourly until quota recovers.
- **`--duration-hours`**: Duration for the run.
- **`--start-page` / `--section`** (optional): Start or bound processing to specific pages (e.g. `--start-page 10b` or `--section 2a`).

## 2. Antigravity Execution Flags

When running from Antigravity:
- **`BypassSandbox: true`**: Required for LLM CLI and GitHub remote operations.
- **`IsDaemon: true`** with `WaitMsBeforeAsync: 8000`: Allows long-running translation to execute in the background without blocking conversation turns.

## 3. Worktree Management & Parallel Runs

- **Direct Commits & PRs**: The translation runner commits and pushes pending candidates directly within its active worktree to its own branch and creates/updates a PR for that branch.
- **Parallel Safety**: Multiple translation runs can execute concurrently in separate worktrees without collisions.

## 4. Graceful Stopping & PR Creation

To stop a running translation runner early, terminate all active agents, commit/push all pending candidates, and create or update the PR:
- Send `SIGINT` to the process:
  ```bash
  kill -INT <PID>
  ```
- The runner will:
  1. Immediately terminate any active LLM agent processes
  2. Stop processing further candidates and wake any quota sleep.
  3. Commit all pending translation candidates.
  4. Create/update the GitHub PR.
  5. Exit cleanly with status 0.
- Sending a second signal while shutdown/push is in progress forces an immediate exit.
