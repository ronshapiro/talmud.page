import re

_ABBREVIATIONS = [
    {
        "abbreviation": "a.",
        "expanded": "and",
    },
    {
        "abbreviation": "a. e.",
        "expanded": "and elsewhere",
    },
    {
        "abbreviation": "a. fr.",
        "expanded": "and frequently",
    },
    {
        "abbreviation": "a. l.",
        "expanded": "ad locum",
    },
    {
        "abbreviation": "a. v. fr.",
        "expanded": "and very frequently",
    },
    {
        "abbreviation": "Ab.",
        "expanded": "Pirkei Avot",
    },
    {
        "abbreviation": "Ab. d’R. N.",
        "expanded": "Avoth D'Rabbi Natan",
    },
    {
        "abbreviation": "Ab. Zar.",
        "expanded": "Avodah Zarah",
    },
    {
        "abbreviation": "abbrev.",
        "expanded": "abbreviated or abbreviation.",
        "exceptions": ["ambiguous"],
    },
    {
        "abbreviation": "add.",
        "expanded": "additamenta (Hosafah to Pesik. R.)",
        "exceptions": ["unclear"],
    },
    {
        "abbreviation": "adj.",
        "expanded": "adjective",
    },
    {
        "abbreviation": "adv.",
        "expanded": "adverb",
    },
    {
        "abbreviation": "Ag. Hatt.",
        "expanded": "Agadoth hat-Torah (quoted in Rabbinowicz Variæ Lectiones).",
    },
    {
        "abbreviation": "Alf.",
        "expanded": "Hilkhot Rabbeinu Alfasi",
    },
    {
        "abbreviation": "Am.",
        "expanded": "Amos",
    },
    {
        "abbreviation": "Ar.",
        "expanded": "Arukh",
    },
    {
        "abbreviation": "Ar. Compl.",
        "expanded": "Arukh Completum ed. Alexander Kohut, Vienna 1878-85.",
    },
    {
        "abbreviation": "Arakh.",
        "expanded": "Arakhin",
    },
    {
        "abbreviation": "art.",
        "expanded": "article",
    },
    {
        "abbreviation": "B. Bath.",
        "expanded": "Bava Batra",
    },
    {
        "abbreviation": "b. h.",
        "expanded": "Biblical Hebrew",
    },
    {
        "abbreviation": "B. Kam.",
        "expanded": "Bava Kamma",
    },
    {
        "abbreviation": "B. Mets.",
        "expanded": "Bava Metzia",
    },
    {
        "abbreviation": "B. N.",
        "expanded": "Beth Nathan (quoted in Rabbinowicz Variæ Lectiones)",
    },
    {
        "abbreviation": "Bab.",
        "expanded": "Bavli",
    },
    {
        "abbreviation": "Bart.",
        "expanded": "Bartenura",
    },
    {
        "abbreviation": "beg.",
        "expanded": "beginning",
    },
    {
        "abbreviation": "Beitr.",
        "expanded": "Beiträge zur Sprach- und Alterthumsforschung, by Michael Sachs, Berlin 1852—54, 2 vols, v. Berl. a. Hildesh",
    },
    {
        "abbreviation": "Bekh.",
        "expanded": "Bekhoroth",
    },
    {
        "abbreviation": "Ber.",
        "expanded": "Berakhot",
    },
    {
        "abbreviation": "Berl.",
        "expanded": "Berliner (editor of Targum Onkelos)",
    },
    {
        "abbreviation": "Berl. Beitr.",
        "expanded": "Berliner Beiträge zur Geographie und Ethnographie Babyloniens, Berlin 1884",
    },
    {
        "abbreviation": "Bets.",
        "expanded": "Beitzah",
    },
    {
        "abbreviation": "B’ḥuck.",
        "expanded": "Bechukotai",
    },
    {
        "abbreviation": "Bicc.",
        "expanded": "Bikkurim",
    },
    {
        "abbreviation": "bot.",
        "expanded": "bottom of page",
    },
    {
        "abbreviation": "B’resh.",
        "expanded": "Bereshit",
    },
    {
        "abbreviation": "B’shall.",
        "expanded": "Beshalach",
    },
    {
        "abbreviation": "c.",
        "expanded": "common gender.",
    },
    {
        "abbreviation": "Cant.",
        "expanded": "Song of Songs", # Canticum
        "exceptions": ["low priority"],
    },
    {
        "abbreviation": "Cant. R.",
        "expanded": "Shir HaShirim Rabbah",
    },
    {
        "abbreviation": "ch.",
        "expanded": "Chaldaic",
    },
    {
        "abbreviation": "Ch.",
        "expanded": "Chaldaic",
    },
    {
        "abbreviation": "Chron.",
        "expanded": "Chronicles",
    },
    {
        "abbreviation": "cmp.",
        "expanded": "compare",
    },
    {
        "abbreviation": "comment.",
        "expanded": "commentary or commentaries",
        "exceptions": ["ambiguous"],
    },
    {
        "abbreviation": "comp.",
        "expanded": "compound or composed",
        "exceptions": ["ambiguous"],
    },
    {
        "abbreviation": "contr.",
        "expanded": "contracted or contraction",
        "exceptions": ["ambiguous"],

    },
    {
        "abbreviation": "contrad.",
        "expanded": "contradistinguished",
    },
    {
        "abbreviation": "corr.",
        "expanded": "correct",
        "exceptions": ["low priority"],
    },
    {
        "abbreviation": "corr. acc.",
        "expanded": "correct accordingly",
    },
    {
        "abbreviation": "corrupt.",
        "expanded": "corruption",
    },
    {
        "abbreviation": "Curt. Griech. Etym.",
        "expanded": "Curtius Griechische Etymologie",
    },
    {
        "abbreviation": "Dan.",
        "expanded": "Daniel",
    },
    {
        "abbreviation": "Darkhe Mish.",
        "expanded": "Frankel, Hodegetica in Mishnam, Leipzig 1859 (Hebrew)",
    },
    {
        "abbreviation": "def.",
        "expanded": "defining or definition",
        "exceptions": ["ambiguous"],
    },
    {
        "abbreviation": "Del.",
        "expanded": "Delitzsch, Friedrich",
    },
    {
        "abbreviation": "Del. Assyr. Handw.",
        "expanded": "Delitzsch Assyrisches Handwörterbuch, Leipzig 1896",
    },
    {
        "abbreviation": "Del. Proleg.",
        "expanded": "Delitzsch Prolegomena eines neuen Hebräisch-Aramäischen Wörterbuchs &c",
    },
    {
        "abbreviation": "Dem.",
        "expanded": "Demai",
    },
    {
        "abbreviation": "denom.",
        "expanded": "denominative",
    },
    {
        "abbreviation": "Der. Er.",
        "expanded": "Derekh Eretz (Ethics, a late Talmudic treatise, Rabbah [the great], Zuṭa [the small])",
        "exceptions": ["review"],
    },
    {
        "abbreviation": "Deut.",
        "expanded": "Devarim",
        "exceptions": ["low priority"],
    },
    {
        "abbreviation": "Deut. R.",
        "expanded": "Devarim Rabbah",
    },
    {
        "abbreviation": "diff.",
        "expanded": "different interpretation or differently interpreted",
    },
    {
        "abbreviation": "differ.",
        "expanded": "different interpretation or differently interpreted",
    },
    {
        "abbreviation": "dimin.",
        "expanded": "diminutive",
    },
    {
        "abbreviation": "Du.",
        "expanded": "Dual",
    },
    {
        "abbreviation": "ed.",
        "expanded": "edition or editions (current editions, opposed to manuscripts or especially quoted editions).",
        "exceptions": ["ambiguous"],
    },
    {
        "abbreviation": "Ed.",
        "expanded": "Eduyot",
    },
    {
        "abbreviation": "ellipt.",
        "expanded": "elliptically",
    },
    {
        "abbreviation": "Erub.",
        "expanded": "Eruvin",
    },
    {
        "abbreviation": "esp.",
        "expanded": "especially",
    },
    {
        "abbreviation": "Esth.",
        "expanded": "Esther",
        "exceptions": ["low priority"],
    },
    {
        "abbreviation": "Esth. R.",
        "expanded": "Esther Rabbah",
    },
    {
        "abbreviation": "Ex.",
        "expanded": "Shemot",
        "exceptions": ["low priority"],
    },
    {
        "abbreviation": "Ex. R.",
        "expanded": "Shemot Rabbah",
    },
    {
        "abbreviation": "expl.",
        "expanded": "explained",
    },
    {
        "abbreviation": "explan.",
        "expanded": "explanation",
    },
    {
        "abbreviation": "Ez.",
        "expanded": "Ezekiel",
    },
    {
        "abbreviation": "Fl.",
        "expanded": "Fleisher, appendix to Levy’s Targumic or Talmudic Lexicon.",
    },
    {
        "abbreviation": "foreg.",
        "expanded": "foregoing",
    },
    {
        "abbreviation": "fr.",
        "expanded": "from",
    },
    {
        "abbreviation": "freq.",
        "expanded": "frequently",
    },
    {
        "abbreviation": "Fr.",
        "expanded": "Friedman (edition)",
    },
    {
        "abbreviation": "Frank.",
        "expanded": "Frankel, v. Darkhe, and M’bo.",
    },
    {
        "abbreviation": "Gem.",
        "expanded": "Gemara",
    },
    {
        "abbreviation": "Gen.",
        "expanded": "Breishit",
        "exceptions": ["low priority"],
    },
    {
        "abbreviation": "gen. of",
        "expanded": "genitive of",
    },
    {
        "abbreviation": "Gen. R.",
        "expanded": "Breishit Rabbah",
    },
    {
        "abbreviation": "Ges. H. Dict.",
        "expanded": "Gesenius Hebrew Dictionary, 8th German edition",
    },
    {
        "abbreviation": "Gitt.",
        "expanded": "Gittin",
    },
    {
        "abbreviation": "Gloss.",
        "expanded": "Glossary",
    },
    {
        "abbreviation": "Hab.",
        "expanded": "Habakkuk",
    },
    {
        "abbreviation": "Hag.",
        "expanded": "Haggai",
    },
    {
        "abbreviation": "Ḥag.",
        "expanded": "Chagigah",
    },
    {
        "abbreviation": "Ḥall.",
        "expanded": "Hallah",
    },
    {
        "abbreviation": "Hif.",
        "expanded": "Hifil",
    },
    {
        "abbreviation": "Hildesh. Beitr.",
        "expanded": "Hildesheimer Beiträge zur Geographie Palestinas, Berlin 1886.",
    },
    {
        "abbreviation": "Hithpa.",
        "expanded": "Hithpaël",
    },
    {
        "abbreviation": "Hithpo.",
        "expanded": "Hitpolel",
    },
    {
        "abbreviation": "Hor.",
        "expanded": "Horayot",
    },
    {
        "abbreviation": "Hos.",
        "expanded": "Hosea",
    },
    {
        "abbreviation": "Ḥuck.",
        "expanded": "Chukat",
    },
    {
        "abbreviation": "Ḥull.",
        "expanded": "CHullin",
    },
    {
        "abbreviation": "intens.",
        "expanded": "intensive",
    },
    {
        "abbreviation": "introd.",
        "expanded": "introduction",
    },
    {
        "abbreviation": "Is.",
        "expanded": "Isaiah",
    },
    {
        "abbreviation": "Isp.",
        "expanded": "Ispeel",
    },
    {
        "abbreviation": "Ithpa.",
        "expanded": "Ithpaal",
    },
    {
        "abbreviation": "Ithpe.",
        "expanded": "Ithpeel",
    },
    {
        "abbreviation": "Jer.",
        "expanded": "Jeremiah",
    },
    {
        "abbreviation": "Jon.",
        "expanded": "Jonah",
    },
    {
        "abbreviation": "Jos.",
        "expanded": "Josephus",
    },
    {
        "abbreviation": "Josh.",
        "expanded": "Joshua",
    },
    {
        "abbreviation": "Jud.",
        "expanded": "Judges",
    },
    {
        "abbreviation": "K.A.T.",
        "expanded": "Keilinschriften und das Alte Testament by Schrader (second edition), Giessen 1883.",
    },
    {
        "abbreviation": "KAT",
        "expanded": "Keilinschriften und das Alte Testament by Schrader (second edition), Giessen 1883.",
    },
    {
        "abbreviation": "Kel.",
        "expanded": "Kelim",
    },
    {
        "abbreviation": "Ker.",
        "expanded": "Keritot",
    },
    {
        "abbreviation": "Keth.",
        "expanded": "Ketubot",
    },
    {
        "abbreviation": "Kidd.",
        "expanded": "Kiddushin",
    },
    {
        "abbreviation": "Kil.",
        "expanded": "Kilayim",
    },
    {
        "abbreviation": "Kin.",
        "expanded": "Kinnim",
    },
    {
        "abbreviation": "Koh.",
        "expanded": "Kohelet",
        "exceptions": ["low priority"],
    },
    {
        "abbreviation": "Koh. Ar. Compl.",
        "expanded": "Kohut in Aruch Completum",
    },
    {
        "abbreviation": "Koh. R.",
        "expanded": "Kohelet Rabbah",
    },
    {
        "abbreviation": "l. c.",
        "expanded": "loco citato or locum citatum.",
        "exceptions": ["loc cit"],
    },
    {
        "abbreviation": "Lam.",
        "expanded": "Eicha",
        "exceptions": ["low priority"],
    },
    {
        "abbreviation": "Lam. R.",
        "expanded": "Eicha Rabbah",
    },
    {
        "abbreviation": "Lev.",
        "expanded": "Vayikra",
        "exceptions": ["low priority"],
    },
    {
        "abbreviation": "Lev. R.",
        "expanded": "Vayikra Rabbah",
    },
    {
        "abbreviation": "M. Kat.",
        "expanded": "Moʿed Katan",
    },
    {
        "abbreviation": "Maas. Sh.",
        "expanded": "Ma'aser Sheni",
    },
    {
        "abbreviation": "Maasr.",
        "expanded": "Ma'asrot",
    },
    {
        "abbreviation": "Macc.",
        "expanded": "Makkot",
    },
    {
        "abbreviation": "Maim.",
        "expanded": "Maimonides",
    },
    {
        "abbreviation": "Makhsh.",
        "expanded": "Makhshirin",
    },
    {
        "abbreviation": "Mal.",
        "expanded": "Malachi",
    },
    {
        "abbreviation": "marg. vers.",
        "expanded": "marginal version.",
    },
    {
        "abbreviation": "Mass.",
        "expanded": "Masechet",
    },
    {
        "abbreviation": "Mat. K.",
        "expanded": "Mattnot Kehuna",
    },
    {
        "abbreviation": "M’bo",
        "expanded": "Frankel, Introductio in Talmud Hierosolymitanum. Breslau 1870 (Hebrew)",
    },
    {
        "abbreviation": "Meg.",
        "expanded": "Megillah",
    },
    {
        "abbreviation": "Meil.",
        "expanded": "Meilah",
    },
    {
        "abbreviation": "Mekh.",
        "expanded": "Mekhilta",
    },
    {
        "abbreviation": "Men.",
        "expanded": "Menachot",
    },
    {
        "abbreviation": "Mic.",
        "expanded": "Micah",
    },
    {
        "abbreviation": "Midd.",
        "expanded": "Middot",
    },
    {
        "abbreviation": "Midr.",
        "expanded": "Midrash",
    },
    {
        "abbreviation": "Midr. Sam.",
        "expanded": "Midrash Samuel",
    },
    {
        "abbreviation": "Midr. Till.",
        "expanded": "Midrash Tillim (Midrash to Psalms, Shoḥer Ṭob).",
    },
    {
        "abbreviation": "Mikv.",
        "expanded": "Mikvaot",
    },
    {
        "abbreviation": "Mish.",
        "expanded": "Mishnah",
    },
    {
        "abbreviation": "Mish. N. or Nap.",
        "expanded": "Mishnah, editio Napolis",
    },
    {
        "abbreviation": "Mish. Pes.",
        "expanded": "Mishnah, editio Pesaro",
    },
    {
        "abbreviation": "Mishp.",
        "expanded": "Mishpatim",
    },
    {
        "abbreviation": "Ms.",
        "expanded": "Manuscript",
        "exceptions": ["low priority"],
    },
    {
        "abbreviation": "Ms. F.",
        "expanded": "Manuscript Florence",
    },
    {
        "abbreviation": "Ms. H.",
        "expanded": "Manuscript Hamburg",
    },
    {
        "abbreviation": "Ms. K.",
        "expanded": "Manuscript Karlsruhe",
    },
    {
        "abbreviation": "Ms. M.",
        "expanded": "Manuscript Munich",
    },
    {
        "abbreviation": "Ms. O.",
        "expanded": "Manuscript Oxford",
    },
    {
        "abbreviation": "Ms. R.",
        "expanded": "Manuscript Rome",
    },
    {
        "abbreviation": "Mus.",
        "expanded": "Musafia (additamenta to Arukh)",
    },
    {
        "abbreviation": "Nah.",
        "expanded": "Nahum",
    },
    {
        "abbreviation": "Naz.",
        "expanded": "Nazir",
    },
    {
        "abbreviation": "Neg.",
        "expanded": "Negaim",
    },
    {
        "abbreviation": "Neh.",
        "expanded": "Nehemiah",
    },
    {
        "abbreviation": "Neub. Géogr.",
        "expanded": "Neubauer Géographie du Talmud, Paris 1868",
    },
    {
        "abbreviation": "Ned.",
        "expanded": "Nedarim",
    },
    {
        "abbreviation": "Nidd.",
        "expanded": "Niddah",
    },
    {
        "abbreviation": "Nif.",
        "expanded": "Nifal",
    },
    {
        "abbreviation": "Nithpa.",
        "expanded": "Nithpaël",
    },
    {
        "abbreviation": "Num.",
        "expanded": "Bamidbar",
        "exceptions": ["low priority"],
    },
    {
        "abbreviation": "Num. R.",
        "expanded": "Bamidabar Rabbah",
    },
    {
        "abbreviation": "Ob.",
        "expanded": "Obadiah",
    },
    {
        "abbreviation": "Ohol.",
        "expanded": "Oholot",
    },
    {
        "abbreviation": "onomatop.",
        "expanded": "onomatopoetic",
    },
    {
        "abbreviation": "opin.",
        "expanded": "opinion",
    },
    {
        "abbreviation": "opp.",
        "expanded": "opposed",
    },
    {
        "abbreviation": "Orl.",
        "expanded": "Orlah",
    },
    {
        "abbreviation": "oth.",
        "expanded": "other, another, others.",
        "exceptions": ["ambiguous"],
    },
    {
        "abbreviation": "P. Sm.",
        "expanded": "Payne Smith, Thesaurus Syriacus",
    },
    {
        "abbreviation": "Par.",
        "expanded": "Parah",
    },
    {
        "abbreviation": "Par.",
        "expanded": "Parashah",
    },
    {
        "abbreviation": "part.",
        "expanded": "participle",
    },
    {
        "abbreviation": "Perl. Et. St.",
        "expanded": "Perles Etymologische Studien, Breslau 1871",
    },
    {
        "abbreviation": "pers. pron.",
        "expanded": "personal pronoun",
    },
    {
        "abbreviation": "Pes.",
        "expanded": "Pesachim",
    },
    {
        "abbreviation": "Pesik.",
        "expanded": "Pesikta d'Rav Kahana",
    },
    {
        "abbreviation": "Pesik. R.",
        "expanded": "Pesikta Rabbathi",
    },
    {
        "abbreviation": "Pesik. Zutr.",
        "expanded": "Peskita Zutrati",
    },
    {
        "abbreviation": "Pfl.",
        "expanded": "Löw, Aramäische Pflanzennamen, Leipzig 1881",
    },
    {
        "abbreviation": "phraseol.",
        "expanded": "phraseology",
    },
    {
        "abbreviation": "Pi.",
        "expanded": "Piël",
    },
    {
        "abbreviation": "pl.",
        "expanded": "plural",
        "exceptions": ["low priority"],
    },
    {
        "abbreviation": "Pl.",
        "expanded": "plural",
        "exceptions": ["low priority"],
    },
    {
        "abbreviation": "pr. n.",
        "expanded": "proper noun",
        "exceptions": ["low priority"],
    },
    {
        "abbreviation": "pr. n. f.",
        "expanded": "proper noun of a female person",
    },
    {
        "abbreviation": "pr. n. m.",
        "expanded": "proper noun of a male person",
    },
    {
        "abbreviation": "pr. n. pl.",
        "expanded": "proper noun of a place",
    },
    {
        "abbreviation": "preced.",
        "expanded": "preceding",
        "exceptions": ["low priority"],
    },
    {
        "abbreviation": "preced. art.",
        "expanded": "preceding article",
    },
    {
        "abbreviation": "preced. w.",
        "expanded": "preceding word",
    },
    {
        "abbreviation": "prep.",
        "expanded": "preposition",
    },
    {
        "abbreviation": "prob.",
        "expanded": "probably",
    },
    {
        "abbreviation": "pron.",
        "expanded": "pronoun",
    },
    {
        "abbreviation": "prop.",
        "expanded": "properly",
    },
    {
        "abbreviation": "prov.",
        "expanded": "a proverb",
    },
    {
        "abbreviation": "Prov.",
        "expanded": "Mishlei",
    },
    {
        "abbreviation": "Ps.",
        "expanded": "Psalms",
    },
    {
        "abbreviation": "q. v.",
        "expanded": "see as well",
    },
    {
        "abbreviation": "r.",
        "expanded": "root or radix",

    },
    {
        "abbreviation": "R.",
        "expanded": "Rab, Rabbi, or Rabbenu.",
        "exceptions": ["skip"],
    },
    {
        "abbreviation": "R. Hash.",
        "expanded": "Rosh Hashanah",
    },
    {
        "abbreviation": "R. S.",
        "expanded": "Rabbenu Shimshon",
    },
    {
        "abbreviation": "Rabb. D. S.",
        "expanded": "Rabbinowicz Diḳduḳé Sof’rim (Variæ Lectiones &c., Munich 1867-84)",
    },
    {
        "abbreviation": "Rap.",
        "expanded": "Rapaport, 'Erekh Millin (Talmudic Cyclopedia, first and only volume)",
    },
    {
        "abbreviation": "ref.",
        # "expanded": "referring, reference.",
        "expanded": "reference.",
    },
    {
        "abbreviation": "Ruth R.",
        "expanded": "Ruth Rabbah",
    },
    {
        "abbreviation": "S.",
        "expanded": "Sophocles, Greek Lexicon of the Roman and Byzantine Periods, Boston 1870",
    },
    {
        "abbreviation": "s.",
        "expanded": "section (Parashah)",
    },
    {
        "abbreviation": "s. v.",
        "expanded": "see also",
    },
    {
        "abbreviation": "Sabb.",
        "expanded": "Shabbat",
    },
    {
        "abbreviation": "Sam.",
        "expanded": "Samuel",
    },
    {
        "abbreviation": "Schr.",
        "expanded": "Schrader, v. KAT",
    },
    {
        "abbreviation": "Sef. Yets",
        "expanded": "Sefer Y’tsirah",
    },
    {
        "abbreviation": "Shebi.",
        "expanded": "Sheviit",
    },
    {
        "abbreviation": "Shebu.",
        "expanded": "Shevuot",
    },
    {
        "abbreviation": "Shek.",
        "expanded": "Shekalim",
    },
    {
        "abbreviation": "Sm. Ant.",
        "expanded": "Smith, Dictionary of Greek and Roman Antiquities, Third American Edition, New-York 1858",
    },
    {
        "abbreviation": "S’maḥ.",
        "expanded": "Masechet Smachot",
    },
    {
        "abbreviation": "Snh.",
        "expanded": "Sanhedrin",
    },
    {
        "abbreviation": "Sonc.",
        "expanded": "Soncino",
    },
    {
        "abbreviation": "Sot.",
        "expanded": "Sotah",
    },
    {
        "abbreviation": "sub.",
        "expanded": "subaudi",
    },
    {
        "abbreviation": "Succ.",
        "expanded": "Sukkah",
    },
    {
        "abbreviation": "suppl.",
        "expanded": "supplement to Pesikta Rabbathi",
    },
    {
        "abbreviation": "Taan.",
        "expanded": "Taanit",
    },
    {
        "abbreviation": "Talm.",
        "expanded": "Talmud",
    },
    {
        "abbreviation": "Tam.",
        "expanded": "Tamid",
    },
    {
        "abbreviation": "Tanḥ.",
        "expanded": "Midrash Tanḥuma",
    },
    {
        "abbreviation": "Tanḥ. ed. Bub.",
        "expanded": "Midrash Tanḥuma, by Buber",
    },
    {
        "abbreviation": "Targ.",
        "expanded": "Targum",
        "exceptions": ["low priority"],
    },
    {
        "abbreviation": "Targ. O.",
        "expanded": "Targum Onkelos",
    },
    {
        "abbreviation": "Targ. Y.",
        "expanded": "Targum Yonatan",
    },
    {
        "abbreviation": "Targ. II",
        "expanded": "Targum Sheni (to Esther)",
    },
    {
        "abbreviation": "Tem.",
        "expanded": "Temurah",
    },
    {
        "abbreviation": "Ter.",
        "expanded": "Terumot",
    },
    {
        "abbreviation": "Toh.",
        "expanded": "Toharot",
    },
    {
        "abbreviation": "Tosaf.",
        "expanded": "Tosafot",
    },
    {
        "abbreviation": "Tosef.",
        "expanded": "Tosefta",
    },
    {
        "abbreviation": "Tosef. ed. Zuck.",
        "expanded": "Tosefta (Zuckermandel edition)",
    },
    {
        "abbreviation": "Treat.",
        "expanded": "Masechet",
    },
    {
        "abbreviation": "Trnsf.",
        "expanded": "Transferred",
    },
    {
        "abbreviation": "trnsp.",
        "expanded": "transposed or transposition.",
        "exceptions": ["ambiguous"],
    },
    {
        "abbreviation": "Ukts.",
        "expanded": "'Uktzin",
    },
    {
        "abbreviation": "usu.",
        "expanded": "usually",
    },
    {
        "abbreviation": "v.",
        "expanded": "see",
    },
    {
        "abbreviation": "Var.",
        "expanded": "Variant",
    },
    {
        "abbreviation": "var. lect.",
        "expanded": "variatio lectionis",
    },
    {
        "abbreviation": "Ven.",
        "expanded": "Venice",
    },
    {
        "abbreviation": "vers.",
        "expanded": "version",
    },
    {
        "abbreviation": "Vien.",
        "expanded": "Vienna",
    },
    {
        "abbreviation": "w.",
        "expanded": "word",
    },
    {
        "abbreviation": "Wil.",
        "expanded": "Vilna",
    },
    {
        "abbreviation": "ws.",
        "expanded": "words",
    },
    {
        "abbreviation": "Y.",
        "expanded": "Yerushalmi",
    },
    {
        "abbreviation": "Yad.",
        "expanded": "Yadayim",
    },
    {
        "abbreviation": "Yalk.",
        "expanded": "Yalkut",
    },
    {
        "abbreviation": "Yeb.",
        "expanded": "Yevamot",
    },
    {
        "abbreviation": "Y’lamd.",
        "expanded": "Y’lamdenu (a lost book, corresponding to Tanḥuma, quoted in Arukh)",
    },
    {
        "abbreviation": "Zab.",
        "expanded": "Zavim",
    },
    {
        "abbreviation": "Zakh.",
        "expanded": "Zachor",
    },
    {
        "abbreviation": "Zeb.",
        "expanded": "Zevachim",
    },
    {
        "abbreviation": "Zech.",
        "expanded": "Zechariah",
    },
    {
        "abbreviation": "Zeph.",
        "expanded": "Zephaniah",
    },
    {
        "abbreviation": "Zuck.",
        "expanded": "Zuckermandel (see Tosefefta)",
    },
    {
        "abbreviation": "Zuckerm.",
        "expanded": "Zuckermann Talmudische Münzen und Gewichte, Breslau 1862",
    },
]

for abbreviation in _ABBREVIATIONS:
    abbreviation["regex"] = re.compile("(^| |—)(\\()?%s" % (
        abbreviation["abbreviation"].replace(".", "\\.")))

_ORDERED_ABBREVIATIONS = []

for abbreviation in _ABBREVIATIONS:
    if "exceptions" not in abbreviation:
        _ORDERED_ABBREVIATIONS.append(abbreviation)

for abbreviation in _ABBREVIATIONS:
    if "exceptions" in abbreviation and "low priority" in abbreviation["exceptions"]:
        _ORDERED_ABBREVIATIONS.append(abbreviation)

def deabbreviate_jastrow(list_of_text):
    return tuple(map(_deabbreviate_jastrow, list_of_text))

def _deabbreviate_jastrow(text):
    for abbreviation in _ORDERED_ABBREVIATIONS:
        text = _apply_regex(text, abbreviation)
    return text

def _apply_regex(text, abbreviation):
    pieces = []
    last_start = 0
    for match in abbreviation["regex"].finditer(text):
        pieces.append(text[last_start:match.start()])
        if match.group(1):
            pieces.append(match.group(1))
        if match.group(2):
            pieces.append(match.group(2))
        pieces.append(abbreviation["expanded"])
        last_start = match.end()
    pieces.append(text[last_start:])
    return "".join(pieces)
