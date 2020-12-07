#!/bin/bash

set -eu
shopt -s extglob

npx ts-node pre-commit/pre-commit.ts -- $@
