#!/bin/bash

set -eu
shopt -s extglob

npx --loglevel=silent tsc
