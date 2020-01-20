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

function download() {
    local target_file="sefaria-data/Talmud/Bavli/$1/$2.json"
    local url="$3"
    wget -q -O "$target_file" "$url"

    if [[ ! -s "$target_file" ]]; then
       rm "$target_file"
    fi
}



for masechet in "${MASECHTOT[@]}"; do
    url_masechet="${masechet// /%20}"
    download "$masechet" "Rashba" \
             "https://www.sefaria.org/download/version/Rashba%20on%20${url_masechet}%20-%20he%20-%20merged.json"

    download "$masechet" "Ramban" \
             "https://www.sefaria.org/download/version/Chiddushei%20Ramban%20on%20${url_masechet}%20-%20he%20-%20Chiddushei%20HaRamban,%20Jerusalem%201928-29.json"
done

