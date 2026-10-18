#!/usr/bin/env bash
set -euo pipefail

# setup_and_train.sh
# End-to-end setup and fine-tuning runner for Gemma 4 RSI models on any GPU instance.
# Usage:
#   ./scripts/setup_and_train.sh [e2b|e4b]

VARIANT="${1:-e2b}"

if [ "$VARIANT" = "e4b" ]; then
  MODEL_NAME="google/gemma-4-e4b-it"
  OUTPUT_NAME="gemma4:e4b-rsi-rashi-v1"
else
  MODEL_NAME="google/gemma-4-e2b-it"
  OUTPUT_NAME="gemma4:e2b-rsi-rashi-v1"
fi

echo "=== 1. Checking Python and GPU Environment ==="
python3 --version
nvidia-smi || echo "Warning: nvidia-smi not detected (running on CPU/Metal?)"

echo "=== 2. Installing Required Dependencies ==="
pip install --upgrade pip
pip install "unsloth[colab-new] @ git+https://github.com/unslothai/unsloth.git"
pip install --no-deps "xformers<0.0.29" "trl<0.9.0" peft accelerate bitsandbytes datasets

echo "=== 3. Generating SFT Training Dataset if not present ==="
if [ ! -f "precomputed/rsi_state/sft_dataset.jsonl" ]; then
  python3 rsi_orchestrator/create_sft_dataset.py
fi

echo "=== 4. Starting Fine-Tuning for ${OUTPUT_NAME} ==="
python3 rsi_orchestrator/train_gemma_rsi.py \
  --model-name "${MODEL_NAME}" \
  --output-model-name "${OUTPUT_NAME}" \
  --dataset-path "precomputed/rsi_state/sft_dataset.jsonl" \
  --maximum-sequence-length 2048 \
  --number-of-epochs 1

echo "=== Complete! ==="
