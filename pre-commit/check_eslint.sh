#!/bin/bash

set -eu
shopt -s extglob

files=()
extra_opts=()

for x in "$@"; do
    case $x in
        "--dev") extra_opts+=("--config" ".eslintrc.dev.js");;
        *.@(js|jsx|ts|tsx) ) files+=($x);;
    esac
done

npx --loglevel silent eslint ${extra_opts[@]:-} --color ${files[@]:-}
