#!/bin/bash

set -eu

PREFIX="https://raw.githubusercontent.com/Sefaria/Sefaria-Export/master"

rm -rf sefaria-data

function mkdir_cd() {
  mkdir $1
  cd $1
}

mkdir_cd sefaria-data
mkdir {unvocalized,vocalized,english}

########################
########################
########################

function download_section() {
    local section="$1"
    shift 1
    for book in "$@"; do
        local book_prefix="${PREFIX}/json/Tanakh/${section}/${book// /%20}"
        wget -q -O "unvocalized/${book}.json" "${book_prefix}/Hebrew/Tanach%20with%20Text%20Only.json"
        wget -q -O "vocalized/${book}.json" "${book_prefix}/Hebrew/Tanach%20with%20Ta'amei%20Hamikra.json"
        wget -q -O "english/${book}.json" "${book_prefix}/English/The%20Koren%20Jerusalem%20Bible.json"
    done
}

download_section Torah \
                 "Genesis" "Exodus" "Leviticus" "Numbers" "Deuteronomy"
download_section Prophets \
                 "Amos" "Ezekiel" "Habakkuk" "Haggai" "Hosea" "I Kings" \
                 "I Samuel" "II Kings" "II Samuel" "Isaiah" "Jeremiah" "Joel" \
                 "Jonah" "Joshua" "Judges" "Malachi" "Micah" "Nahum" "Obadiah" \
                 "Zechariah" "Zephaniah"
download_section Writings \
                 "Daniel" "Ecclesiastes" "Esther" "Ezra" "I Chronicles" \
                 "II Chronicles" "Job" "Lamentations" "Nehemiah" "Proverbs" \
                 "Psalms" "Ruth" "Song of Songs"

########################
########################
########################

cd ..
