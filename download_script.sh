#!/bin/bash

set -u

MASECHTOT=(
    "Arakhin"
    "Avodah Zarah"
    "Bava Batra"
    "Bava Kamma"
    "Bava Metzia"
    "Beitzah"
    "Bekhorot"
    "Berakhot"
    "Chagigah"
    "Chullin"
    "Eruvin"
    "Gittin"
    "Horayot"
    "Keritot"
    "Ketubot"
    "Kiddushin"
    "Makkot"
    "Megillah"
    "Meilah"
    "Menachot"
    "Moed Katan"
    "Nazir"
    "Nedarim"
    "Niddah"
    "Pesachim"
    "Rosh Hashanah"
    "Sanhedrin"
    "Shabbat"
    "Shevuot"
    "Sotah"
    "Sukkah"
    "Taanit"
    "Tamid"
    "Temurah"
    "Yevamot"
    "Yoma"
    "Zevachim"
)

function url_encode() {
    echo "${1// /%20}"
}

for masechet in "${MASECHTOT[@]}"; do
    target_file="sefaria-data/Talmud/Bavli/${masechet}/Rashba.json"
    wget -q -O "$target_file" \
         "https://www.sefaria.org/download/version/Rashba%20on%20$(url_encode "$masechet")%20-%20he%20-%20merged.json"
    if [[ ! -s "$target_file" ]]; then
       rm "$target_file"
    fi
done

