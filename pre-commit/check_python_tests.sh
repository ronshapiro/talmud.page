#!/bin/bash

#set -eu

. "${VIRTUAL_ENV:-venv}/bin/activate"

for test_file in $(find * | grep test.py\$ | grep -v ^venv); do
    output=$(python $test_file 2>&1)
    if (( $? )); then
        echo $test_file failed:
        echo "$output"
        exit 1
    fi
done
