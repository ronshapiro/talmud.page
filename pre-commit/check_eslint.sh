#!/bin/bash

set -eu
shopt -s extglob

files=()
extra_opts=()
files_from=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dev)
            extra_opts+=("--config" ".eslintrc.dev.js")
            shift
            ;;
        --files-from)
            files_from="$2"
            shift 2
            ;;
        *.@(js|jsx|ts|tsx))
            files+=("$1")
            shift
            ;;
        *)
            shift
            ;;
    esac
done

if [[ -n "$files_from" && -f "$files_from" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
        case "$line" in
            *.@(js|jsx|ts|tsx))
                files+=("$line")
                ;;
        esac
    done < "$files_from"
fi

if [[ ${#files[@]} -eq 0 ]]; then
    exit 0
fi

ESLINT="./node_modules/.bin/eslint"
if [[ ! -x "$ESLINT" ]]; then
    ESLINT="npx --loglevel silent eslint"
fi

$ESLINT ${extra_opts[@]:-} --color "${files[@]}"
