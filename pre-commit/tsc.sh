#!/bin/bash

set -eu
shopt -s extglob

files=()
for x in "$@"; do
    case $x in
        *.@(ts|tsx) ) files+=($x);;
    esac
done

if [[ -n "${files[@]:-}" ]]; then
    npx tsc --noEmit --strict ${files[@]:-}
fi
