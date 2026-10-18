---
name: rsi_clone_and_run
description: Guide for cloning talmud.page, checking out the cached_outputs submodule on remote environments (such as Google Colab or remote GPU instances), installing dependencies, and launching RSI translation runs.
metadata:
  version: 1.0.0
---

# RSI Clone & Run Runbook

Use this skill when preparing and launching Recursive Self-Improving (RSI) Rashi and Tosafot translation runs in fresh, remote, or cloud environments (e.g. Google Colab, cloud VMs, or remote GPU boxes).

Once the environment is cloned and dependencies are set up, see the default RSI skill [continuous-rsi-agent](../continuous-rsi-agent/SKILL.md) for detailed invocation flags, runtime options, and graceful shutdown controls.

---

## 1. GitHub Authentication (Private Submodule)

The main repository is public, but the cached API responses live in a private submodule:
- Main repository: `https://github.com/ronshapiro/talmud.page.git`
- Cached outputs repository: `https://github.com/ronshapiro/talmud.page-cached_outputs.git`

To check out the submodule on a remote machine (like Colab), configure GitHub credentials using a personal access token (`GITHUB_TOKEN` or `GH_TOKEN` with `repo` read access) or authenticate via GitHub CLI:

```bash
# If using a GitHub token (e.g. in Colab notebook or environment):
git config --global url."https://${GITHUB_TOKEN}@github.com/".insteadOf "https://github.com/"

# Or interactively via GitHub CLI:
gh auth login
```

---

## 2. Clone Repository & Check Out Submodule

Clone the main repository and initialize the `cached_outputs` submodule:

```bash
git clone https://github.com/ronshapiro/talmud.page.git
cd talmud.page

# Check out the cached_outputs submodule (fetches precomputed Sefaria API texts)
git submodule update --init cached_outputs
```

> [!IMPORTANT]
> The `cached_outputs/api_request_handler/` directory must be populated for translation candidate discovery and context fetching to work without live Sefaria API hits.

---

## 3. Install Node.js Dependencies

Ensure Node.js (version 18 or newer) is installed, then install project dependencies:

```bash
npm ci    # or npm install
```

---

## 4. Optional: Ollama Setup (for Local Models on GPU)

If generating translations using local models (e.g. Gemma 4 on an Nvidia A100 GPU in Colab Pro):

1. **Install Ollama**:
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```

2. **Start Ollama Service**:
   ```bash
   ollama serve > /tmp/ollama.log 2>&1 &
   # Wait until server is responsive
   until curl -s http://localhost:11434/api/tags >/dev/null 2>&1; do sleep 1; done
   ```

3. **Pull Model**:
   `gemma4:31b` (~17 GB in standard Q4 quantization) is the largest dense Gemma 4 size and fits completely within the 40 GB VRAM of an A100 GPU on Colab Pro:
   ```bash
   ollama pull gemma4:31b
   ```

*(If using cloud backends like `--backend agy` or `--backend claude`, this step can be skipped entirely.)*

---

## 5. Launch Continuous RSI Translation

Launch the continuous translation runner using the CLI:

### Running with Ollama Gemma on A100 (Gemini 3.8 Flash Critique)

The `gemma4-31b` preset under the `ollama` backend embeds the critique model (`gemini-3.8-flash-medium`) and critique backend (`agy`):

```bash
npx ts-node rsi_orchestrator/rashi_tosafot_translation_cli.ts all \
  --backend ollama \
  --model-config gemma4-31b \
  --continuous \
  --duration-hours 24
```

### Running with Antigravity (`agy`) Cloud Backend

```bash
npx ts-node rsi_orchestrator/rashi_tosafot_translation_cli.ts all \
  --backend agy \
  --continuous \
  --duration-hours 24
```

### Running with Claude Backend

```bash
npx ts-node rsi_orchestrator/rashi_tosafot_translation_cli.ts all \
  --backend claude \
  --model-config sonnet-5.5 \
  --continuous \
  --duration-hours 24
```

---

## 6. Next Steps & Default RSI Skill

For comprehensive details on:
- Targeting specific tractates or starting pages (`--start-page`, `--section`, book aliases)
- Antigravity execution flags (`BypassSandbox: true`, `IsDaemon: true`)
- Worktree management and parallel runs
- Graceful shutdown signals (`SIGINT`, `SIGTERM`, `SIGUSR1`) and automatic GitHub PR creation

Refer to the default RSI runbook:
👉 **[continuous-rsi-agent](../continuous-rsi-agent/SKILL.md)**
