#!/bin/bash

set -eu
shopt -s extglob

. venv/bin/activate
npx ts-node pre-commit/pre-commit.ts -- $@
