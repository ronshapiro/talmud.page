#!/usr/bin/python
# -*- coding: utf-8 -*-

_TITLES_TO_BOLDIFY = (
    "Rashi",
    "Tosafot",
)

_SPLITTERS = (
    " - ",
    " – ",
)

def bold_diburei_hamatchil(text, commentary_name):
    if commentary_name not in _TITLES_TO_BOLDIFY:
        return text

    for splitter in _SPLITTERS:
        if splitter in text:
            dibur_hamatchil, comment = text.split(splitter, 1)
            return f'<strong class="dibur-hamatchil">{dibur_hamatchil}</strong>{splitter}{comment}'

    return text
