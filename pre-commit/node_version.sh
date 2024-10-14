#!/usr/bin/env bash

if which gsed &> /dev/null; then
    SED=gsed
else
    SED=sed
fi

NODE_MAJOR_VERSION="$(node --version | ${SED} "s/v\([[:digit:]]\+\).*/\1/")"
if [[ "${NODE_MAJOR_VERSION}" == "21" ]]; then
    NODE_MAJOR_VERSION=20
fi


"${SED}" -i "s/runtime: nodejs.*/runtime: nodejs${NODE_MAJOR_VERSION}/" app.yaml
