#!/bin/bash

for test_file in $(find * | grep \.js\$ | grep -v ^venv); do
    if [[ "$(head -n1 $test_file)" != '"use strict";' ]]; then
        echo $test_file
        echo $(head -n1 $test_file)
        echo not found
    fi
done
