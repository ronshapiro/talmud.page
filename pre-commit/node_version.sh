#!/usr/bin/env bash

NODE_MAJOR_VERSION="$(node --version | gsed "s/v\([[:digit:]]\+\).*/\1/")"
if [[ "${NODE_MAJOR_VERSION}" == "21" ]]; then
    NODE_MAJOR_VERSION=20
fi


gsed -i "s/runtime: nodejs.*/runtime: nodejs${NODE_MAJOR_VERSION}/" app.yaml
