#!/usr/bin/python
# -*- coding: utf-8 -*-

PREFIX = 'ד"ה'

def format_otzar_laazei_rashi(text):
    return text[text.find("<b>"):].replace("<b>", f"<b>{PREFIX} ", 1)
