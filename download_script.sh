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

# (cd sefaria-data/links && grep -R ein\ mishpat | grep Mishneh\ Torah | grep Talmud, | sed 's/.*Mishneh Torah, \(.*\)",Talmud,Halakhah/\1/g' | sort | uniq)
MISHNEH_TORAH=(
    "Admission into the Sanctuary"
    "Agents and Partners"
    "Appraisals and Devoted Property"
    "Blessings"
    "Borrowing and Deposit"
    "Circumcision"
    "Creditor and Debtor"
    "Daily Offerings and Additional Offerings"
    "Damages to Property"
    "Defilement by a Corpse"
    "Defilement by Leprosy"
    "Defilement of Foods"
    "Diverse Species"
    "Divorce"
    "Eruvin"
    "Fasts"
    "Festival Offering"
    "First Fruits and other Gifts to Priests Outside the Sanctuary"
    "Firstlings"
    "Forbidden Foods"
    "Forbidden Intercourse"
    "Foreign Worship and Customs of the Nations"
    "Foundations of the Torah"
    "Fringes"
    "Gifts to the Poor"
    "Heave Offerings"
    "Hiring"
    "Human Dispositions"
    "Immersion Pools"
    "Inheritances"
    "Kings and Wars"
    "Leavened and Unleavened Bread"
    "Levirate Marriage and Release"
    "Marriage"
    "Mourning"
    "Murderer and the Preservation of Life"
    "Nazariteship"
    "Neighbors"
    "Oaths"
    "Offerings for Those with Incomplete Atonement"
    "Offerings for Unintentional Transgressions"
    "One Who Injures a Person or Property"
    "Other Sources of Defilement"
    "Ownerless Property and Gifts"
    "Paschal Offering"
    "Plaintiff and Defendant"
    "Positive Mitzvot"
    "Prayer and the Priestly Blessing"
    "Reading the Shema"
    "Rebels"
    "Red Heifer"
    "Repentance"
    "Rest on a Holiday"
    "Rest on the Tenth of Tishrei"
    "Ritual Slaughter"
    "Robbery and Lost Property"
    "Sabbath"
    "Sabbatical Year and the Jubilee"
    "Sacrifices Rendered Unfit"
    "Sacrificial Procedure"
    "Sales"
    "Sanctification of the New Month"
    "Scroll of Esther and Hanukkah"
    "Second Tithes and Fourth Year's Fruit"
    "Service on the Day of Atonement"
    "Sheqel Dues"
    "Shofar, Sukkah and Lulav"
    "Slaves"
    "Substitution"
    "Tefillin, Mezuzah and the Torah Scroll"
    "Testimony"
    "The Chosen Temple"
    "Theft"
    "The Order of Prayer"
    "The Sanhedrin and the Penalties within their Jurisdiction"
    "Things Forbidden on the Altar"
    "Those Who Defile Bed or Seat"
    "Tithes"
    "Torah Study"
    "Trespass"
    "Vessels"
    "Vessels of the Sanctuary and Those who Serve Therein"
    "Virgin Maiden"
    "Vows"
    "Woman Suspected of Infidelity"
)

function download() {
    local target_file="sefaria-data/$1.json"
    local url="${2// /%20}"
    wget -q -O "${target_file}" "${url}"

    if [[ ! -s "$target_file" ]]; then
       rm "$target_file"
    fi
}

if [ $# -eq 0 ] || [[ "$1" == "tanakh" ]] ; then
    for book in "${TANAKH_SEFARIM[@]}"; do
        url_book="${book// /%20}"
        download "bible/hebrew/${book}" \
                 "https://www.sefaria.org/download/version/${url_book}%20-%20he%20-%20Tanach%20with%20Nikkud.json"
    done
fi

if [ $# -eq 0 ] || [[ "$1" == "talmud" ]] ; then
    for masechet in "${MASECHTOT[@]}"; do
        url_masechet="${masechet// /%20}"
        download "Talmud/Bavli/$masechet/Rashba" \
                 "https://www.sefaria.org/download/version/Rashba%20on%20${url_masechet}%20-%20he%20-%20merged.json"

        download "Talmud/Bavli/$masechet/Ramban" \
                 "https://www.sefaria.org/download/version/Chiddushei%20Ramban%20on%20${url_masechet}%20-%20he%20-%20Chiddushei%20HaRamban,%20Jerusalem%201928-29.json"
    done
fi

if [ $# -eq 0 ] || [[ "$1" == "halakha" ]] ; then
    for tur in "Orach Chayim" "Yoreh De'ah" "Even HaEzer" "Choshen Mishpat"; do
        download "halacha/Shulchan Aruch, ${tur} Hebrew" \
                 "https://www.sefaria.org/download/version/Shulchan Arukh, ${tur} - he - Wikisource Shulchan Aruch.json"
        download "halacha/Shulchan Aruch, ${tur} English" \
                 "https://www.sefaria.org/download/version/Shulchan Arukh, ${tur} - en - Wikisource Shulchan Aruch.json"
    done

    for book in "${MISHNEH_TORAH[@]}"; do
        download "halacha/Mishneh Torah, ${book} Hebrew" \
                 "https://www.sefaria.org/download/version/Mishneh Torah, ${book} - he - merged.json"
        download "halacha/Mishneh Torah, ${book} English" \
                 "https://www.sefaria.org/download/version/Mishneh Torah, ${book} - en - merged.json"
    done

    download "halacha/Sefer Mitzvot Gadol Hebrew" \
             "https://www.sefaria.org/download/version/Sefer%20Mitzvot%20Gadol%20-%20he%20-%20Munkatch,%201901.json"
fi
