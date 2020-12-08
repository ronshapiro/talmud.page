#!/bin/bash

set -eu
shopt -s extglob

parcel=""
files=()
for x in "$@"; do
    case $x in
        parcel.ts ) parcel="parcel.ts";;
        *.@(ts|tsx) ) files+=($x);;
    esac
done

args() {
    echo --noEmit \
         --strict \
         --pretty \
         --jsx react
}

if [[ -n "${files[@]:-}" ]]; then
    npx tsc $(args) --esModuleInterop ${files[@]:-}
fi

if [[ -n "${parcel}" ]]; then
    npx tsc $(args) "${parcel}"
fi
