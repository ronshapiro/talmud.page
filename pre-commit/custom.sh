#!/bin/bash

set -eu
shopt -s extglob

echo "[custom.sh] Invoked with $# arguments" >&2
[[ -e venv/bin/activate ]] && . venv/bin/activate
npx ts-node pre-commit/pre-commit.ts -- "$@"
