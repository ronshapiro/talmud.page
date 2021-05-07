#!/bin/bash

set -eu
shopt -s extglob

[[ -e venv/bin/activate ]] && . venv/bin/activate
npx ts-node pre-commit/pre-commit.ts -- $@
