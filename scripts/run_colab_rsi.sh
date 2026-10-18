#!/usr/bin/env bash
set -euo pipefail

# Configuration defaults
target_book="${1:-all}"
if [[ $# -gt 0 ]]; then
  shift
fi

duration_hours="${DURATION_HOURS:-24}"
model_name="${MODEL:-gemma4:31b}"
critique_backend="${CRITIQUE_BACKEND:-agy}"
critique_model="${CRITIQUE_MODEL:-gemini-3.8-flash-medium}"
repository_url="https://github.com/ronshapiro/talmud.page.git"
repository_directory="${REPOSITORY_DIRECTORY:-talmud.page}"

echo "=========================================================="
echo "Talmud.page Continuous RSI Translation (Colab / Remote)"
echo "Target Book: ${target_book}"
echo "Duration Hours: ${duration_hours}"
echo "Generation Backend: ollama"
echo "Generation Model: ${model_name}"
echo "Critique Backend: ${critique_backend}"
echo "Critique Model: ${critique_model}"
echo "=========================================================="

# 1. Setup GitHub credentials if token is provided
github_authentication_token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
if [[ -n "${github_authentication_token}" ]]; then
  echo "Configuring GitHub credentials from environment token..."
  git config --global url."https://${github_authentication_token}@github.com/".insteadOf "https://github.com/"
fi

# 2. Check out main repository if not already in talmud.page
if [[ ! -f "package.json" ]] || ! grep -q '"name": "talmud.page"' "package.json" 2>/dev/null; then
  if [[ ! -d "${repository_directory}" ]]; then
    echo "Cloning ${repository_url} into ${repository_directory}..."
    git clone "${repository_url}" "${repository_directory}"
  fi
  cd "${repository_directory}"
fi

# 3. Check out cached_outputs submodule
echo "Initializing and updating cached_outputs submodule..."
if ! git submodule update --init cached_outputs; then
  echo "Error: Failed to checkout cached_outputs submodule." >&2
  echo "Note: ronshapiro/talmud.page-cached_outputs is a private repository." >&2
  echo "Please set GITHUB_TOKEN or GH_TOKEN with repository read access." >&2
  exit 1
fi

if [[ ! -d "cached_outputs/api_request_handler" ]]; then
  echo "Error: cached_outputs/api_request_handler directory not found after submodule checkout." >&2
  exit 1
fi
echo "Submodule cached_outputs successfully checked out."

# 4. Install Node.js dependencies
echo "Installing Node.js dependencies..."
if [[ -f "package-lock.json" ]]; then
  npm ci
else
  npm install
fi

# 5. Ensure Ollama is installed and running
if ! command -v ollama >/dev/null 2>&1; then
  echo "Installing Ollama..."
  curl -fsSL https://ollama.com/install.sh | sh
fi

if ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "Starting Ollama service..."
  ollama serve > /tmp/ollama.log 2>&1 &
  maximum_attempts=30
  attempt_counter=0
  while ! curl -s http://localhost:11434/api/tags >/dev/null 2>&1; do
    attempt_counter=$((attempt_counter + 1))
    if [[ ${attempt_counter} -ge ${maximum_attempts} ]]; then
      echo "Error: Ollama server failed to start within timeout. Check /tmp/ollama.log." >&2
      exit 1
    fi
    sleep 1
  done
  echo "Ollama server is active."
fi

# 6. Pull the Gemma model
echo "Pulling Ollama model ${model_name}..."
ollama pull "${model_name}"

# 7. Verify Antigravity CLI (agy)
if ! command -v agy >/dev/null 2>&1; then
  echo "Warning: agy command not found in PATH." >&2
  echo "Please ensure the Antigravity CLI is installed and authenticated for critique." >&2
fi

# 8. Start continuous RSI agent
echo "Starting continuous RSI translation runner..."
npx ts-node rsi_orchestrator/rashi_tosafot_translation_cli.ts "${target_book}" \
  --backend ollama \
  --model "${model_name}" \
  --critique-backend "${critique_backend}" \
  --critique-model "${critique_model}" \
  --continuous \
  --duration-hours "${duration_hours}" \
  "$@"
