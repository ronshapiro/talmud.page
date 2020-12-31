#!/bin/bash

set -eu
shopt -s extglob

webFiles=()
nodeFiles=()
for x in "$@"; do
    case $x in
        js/*.@(ts|tsx))
            webFiles+=($x);;
        *.@(ts|tsx))
            nodeFiles+=($x);;
    esac
done

args() {
    echo --noEmit \
         --strict \
         --pretty
}

if [[ -n "${webFiles[@]:-}" ]]; then
    npx tsc $(args) --lib es2019,dom --esModuleInterop --jsx react ${webFiles[@]:-}
fi

if [[ -n "${nodeFiles[@]:-}" ]]; then
    npx tsc $(args) --lib es2020,dom ${nodeFiles[@]:-}
fi
