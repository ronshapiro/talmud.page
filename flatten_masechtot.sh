#!/bin/bash

for seder_path in sefaria-data/Talmud/Bavli/Seder*; do
    seder="${seder_path#sefaria-data/Talmud/Bavli/}"
    if [[ "$seder" == "Seder*" ]]; then
        break
    fi
    mv "sefaria-data/Talmud/Bavli/$seder"/* sefaria-data/Talmud/Bavli/
    rmdir "sefaria-data/Talmud/Bavli/$seder"

    for commentary in Rashi Tosafot; do
        commentary_dir="sefaria-data/Talmud/Bavli/Commentary/$commentary/$seder"
        for commentary_path in "$commentary_dir/"*; do
            new_commentary_dir="sefaria-data/Talmud/Bavli/$(echo $commentary_path | sed "s/.*$commentary on //")/$commentary"
            mkdir -p "$new_commentary_dir"
            mv "$commentary_path"/* "$new_commentary_dir"
        done
    done
done
