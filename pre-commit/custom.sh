#!/bin/bash

set -eu
shopt -s extglob

[[ -e venv/bin/activate ]] && . venv/bin/activate

file_list="$(mktemp -t precommit_files.XXXXXX)"
cleanup() {
  rm -f "$file_list"
}
trap cleanup EXIT

if [[ $# -gt 0 ]]; then
  printf '%s\n' "$@" > "$file_list"
else
  staged_files="$(git diff --cached --name-only --diff-filter=d 2>/dev/null || true)"
  if [[ -n "$staged_files" ]]; then
    printf '%s\n' "$staged_files" > "$file_list"
  else
    git ls-files > "$file_list"
  fi
fi

TS_NODE="./node_modules/.bin/ts-node"
if [[ ! -x "$TS_NODE" ]]; then
  TS_NODE="npx ts-node"
fi

$TS_NODE pre-commit/pre-commit.ts --files-from "$file_list"
