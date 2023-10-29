#!/usr/bin/env bash

echo "abc"
NODE_MAJOR_VERSION="$(node --version | gsed "s/v\([[:digit:]]\+\).*/\1/")"

echo "abc"

gsed -i "s/runtime: nodejs.*/runtime: nodejs${NODE_MAJOR_VERSION}/" app.yaml
