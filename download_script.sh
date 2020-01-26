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

TANAKH_SEFARIM=(
    "Genesis" "Exodus" "Leviticus" "Numbers" "Deuteronomy"
    \
    "Amos" "Ezekiel" "Habakkuk" "Haggai" "Hosea" "I Kings" "I Samuel"
    "II Kings" "II Samuel" "Isaiah" "Jeremiah" "Joel" "Jonah" "Joshua"
    "Judges" "Malachi" "Micah" "Nahum" "Obadiah" "Zechariah" "Zephaniah"
    \
    "Daniel" "Ecclesiastes" "Esther" "Ezra" "I Chronicles" "II Chronicles"
    "Job" "Lamentations" "Nehemiah" "Proverbs" "Psalms" "Ruth"
    "Song of Songs"
)

function download() {
    local target_file="sefaria-data/$1.json"
    local url="$2"
    wget -q -O "${target_file}" "${url}"

    if [[ ! -s "$target_file" ]]; then
       rm "$target_file"
    fi
}

for book in "${TANAKH_SEFARIM[@]}"; do
    url_book="${book// /%20}"
    download "bible/hebrew/${book}" \
             "https://www.sefaria.org/download/version/${url_book}%20-%20he%20-%20Tanach%20with%20Nikkud.json"
done

for masechet in "${MASECHTOT[@]}"; do
    url_masechet="${masechet// /%20}"
    download "Talmud/Bavli/$masechet/Rashba" \
             "https://www.sefaria.org/download/version/Rashba%20on%20${url_masechet}%20-%20he%20-%20merged.json"

    download "Talmud/Bavli/$masechet/Ramban" \
             "https://www.sefaria.org/download/version/Chiddushei%20Ramban%20on%20${url_masechet}%20-%20he%20-%20Chiddushei%20HaRamban,%20Jerusalem%201928-29.json"
done

