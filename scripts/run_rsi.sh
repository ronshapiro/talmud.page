#!/usr/bin/env bash
set -euo pipefail

# Default configuration values
target_book="all"
backend="ollama"
model_configuration="gemma4-31b"
model_override=""
duration_hours=24
is_continuous=true
section_filter=""
start_page=""
candidate_limit=""
skip_submodule=false
setup_ollama=""
repository_directory="${REPOSITORY_DIRECTORY:-talmud.page}"
repository_url="https://github.com/ronshapiro/talmud.page.git"

print_usage() {
  cat << 'EOF'
Usage: run_rsi.sh [options] [TractateName|all]

Options:
  --backend <name>            Backend to use (e.g. "ollama", "claude", "agy"; default: "ollama")
  --model-config <name>       Model routing preset (e.g. "gemma4-31b", "sonnet-5.5")
  --model <name>              Direct generation model override
  --book <name>               Tractate name or alias, or "all" (default: "all")
  --duration-hours <number>   Duration in hours for continuous mode (default: 24)
  --no-continuous             Run a single pass rather than continuous mode
  --section <section>         Only process this specific section/page, e.g. "77a"
  --start-page <page>         Start processing from this page onwards, e.g. "10b"
  --limit <number>            Cap the number of candidates processed
  --skip-submodule            Skip checking out the cached_outputs git submodule
  --setup-ollama              Force setup of local Ollama daemon and model
  --no-setup-ollama           Skip Ollama installation and daemon setup
  -h, --help                  Show this help message
EOF
}

# Parse named flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend)
      backend="$2"
      shift 2
      ;;
    --backend=*)
      backend="${1#*=}"
      shift
      ;;
    --model-config|--model_config|--backend-config|--backend_config)
      model_configuration="$2"
      shift 2
      ;;
    --model-config=*|--model_config=*|--backend-config=*|--backend_config=*)
      model_configuration="${1#*=}"
      shift
      ;;
    --model)
      model_override="$2"
      shift 2
      ;;
    --model=*)
      model_override="${1#*=}"
      shift
      ;;
    --book)
      target_book="$2"
      shift 2
      ;;
    --book=*)
      target_book="${1#*=}"
      shift
      ;;
    --duration-hours|--duration_hours|--hours)
      duration_hours="$2"
      shift 2
      ;;
    --duration-hours=*|--duration_hours=*|--hours=*)
      duration_hours="${1#*=}"
      shift
      ;;
    --continuous)
      is_continuous=true
      shift
      ;;
    --no-continuous|--no_continuous)
      is_continuous=false
      shift
      ;;
    --section)
      section_filter="$2"
      shift 2
      ;;
    --section=*)
      section_filter="${1#*=}"
      shift
      ;;
    --start-page|--start_page)
      start_page="$2"
      shift 2
      ;;
    --start-page=*|--start_page=*)
      start_page="${1#*=}"
      shift
      ;;
    --limit)
      candidate_limit="$2"
      shift 2
      ;;
    --limit=*)
      candidate_limit="${1#*=}"
      shift
      ;;
    --skip-submodule|--skip_submodule)
      skip_submodule=true
      shift
      ;;
    --setup-ollama|--setup_ollama)
      setup_ollama=true
      shift
      ;;
    --no-setup-ollama|--no_setup_ollama)
      setup_ollama=false
      shift
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    --)
      shift
      break
      ;;
    -*)
      echo "Unknown flag: $1" >&2
      print_usage >&2
      exit 1
      ;;
    *)
      target_book="$1"
      shift
      ;;
  esac
done

if [[ -z "${setup_ollama}" ]]; then
  if [[ "${backend}" == "ollama" ]]; then
    setup_ollama=true
  else
    setup_ollama=false
  fi
fi

echo "=========================================================="
echo "Talmud.page RSI Translation Runner"
echo "Target Book: ${target_book}"
echo "Backend: ${backend}"
echo "Model Config: ${model_configuration:-"(default for backend)"}"
if [[ -n "${model_override}" ]]; then
  echo "Model Override: ${model_override}"
fi
echo "Continuous: ${is_continuous}"
if [[ "${is_continuous}" == "true" ]]; then
  echo "Duration Hours: ${duration_hours}"
fi
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

# 3. Check out cached_outputs submodule if requested
if [[ "${skip_submodule}" == "false" ]]; then
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
else
  echo "Skipping cached_outputs submodule checkout as requested."
fi

# 4. Install Node.js dependencies
echo "Installing Node.js dependencies..."
if [[ -f "package-lock.json" ]]; then
  npm ci
else
  npm install
fi

# 5. Optional Ollama setup and model pulling
if [[ "${setup_ollama}" == "true" ]]; then
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

  model_to_pull="${model_override:-}"
  if [[ -z "${model_to_pull}" ]]; then
    if [[ "${model_configuration}" =~ gemma4-(.+) ]]; then
      model_to_pull="gemma4:${BASH_REMATCH[1]}"
    elif [[ -n "${model_configuration}" ]]; then
      model_to_pull="${model_configuration}"
    else
      model_to_pull="gemma4:31b"
    fi
  fi
  echo "Pulling Ollama model ${model_to_pull}..."
  ollama pull "${model_to_pull}"
fi

# 6. Start continuous RSI agent
cli_arguments=("${target_book}")
cli_arguments+=("--backend" "${backend}")

if [[ -n "${model_configuration}" ]]; then
  cli_arguments+=("--model-config" "${model_configuration}")
fi

if [[ -n "${model_override}" ]]; then
  cli_arguments+=("--model" "${model_override}")
fi

if [[ "${is_continuous}" == "true" ]]; then
  cli_arguments+=("--continuous")
  cli_arguments+=("--duration-hours" "${duration_hours}")
fi

if [[ -n "${section_filter}" ]]; then
  cli_arguments+=("--section" "${section_filter}")
fi

if [[ -n "${start_page}" ]]; then
  cli_arguments+=("--start-page" "${start_page}")
fi

if [[ -n "${candidate_limit}" ]]; then
  cli_arguments+=("--limit" "${candidate_limit}")
fi

if [[ $# -gt 0 ]]; then
  cli_arguments+=("$@")
fi

echo "Starting RSI translation runner..."
npx ts-node rsi_orchestrator/rashi_tosafot_translation_cli.ts "${cli_arguments[@]}"
