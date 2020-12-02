#!/bin/bash

set -eu
shopt -s extglob

files=()
for x in "$@"; do
    case $x in
        *.@(ts|tsx) ) files+=($x);;
    esac
done
npx tsc --noEmit --strict ${files[@]:-}
