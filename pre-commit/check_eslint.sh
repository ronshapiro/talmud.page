#!/bin/bash

set -eu
shopt -s extglob

files=()
for x in "$@"; do
    case $x in
        *.@(js|jsx|ts|tsx) ) files+=($x);;
    esac
done
eslint --color ${files[@]:-}
