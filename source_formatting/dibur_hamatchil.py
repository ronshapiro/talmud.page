#!/usr/bin/python
# -*- coding: utf-8 -*-

_TITLES_TO_BOLDIFY = (
    "Rashi",
    "Tosafot",
)

def bold_diburei_hamatchil(text, commentary_name):
    if commentary_name not in _TITLES_TO_BOLDIFY:
        return text

    if " - " not in text:
        return text

    dibur_hamatchil, comment = text.split(" - ", 1)
    return '<strong class="dibur-hamatchil">%s</strong> - %s' %(dibur_hamatchil, comment)
