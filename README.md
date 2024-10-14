# https://talmud.page [![Build Status](https://travis-ci.org/ronshapiro/talmud.page.svg?branch=base)](https://travis-ci.org/ronshapiro/talmud.page)

A simpler way to read the Talmud.

## Features

- Inline commentaries
  - Clear indidcation of what commentaries are available for the particular line that you are reading; no searching in submenus (or sidebars in physical texts) necessary
  - Expand only the commentaries that you are interested in reading
  - For Rashi and Tosafot, see all super-commentaries and quoted verses inline
- Translations
  - English translations are truncated by default so that reading of the source text is not impaired
  - Steinsaltz is a first-class translation and not just a regular commentary. View the Steinsaltz Hebrew translation side by side with the Talmud and/or the Steinsaltz English translation
- Visual spacing for sugyot (as delineated by Steinsaltz)
- Ability to take notes and highlight the text. All personalizations are saved in Google Docs for your flexibility.
- Highlights references to Rashi from other commentaries.
- Strips printers' formatting that is less relevant for digital contexts, like גמ' and מתני'
- Expands common abbreviations in Jastrow


## Feedback

Feel free to send commits or open issues for bugs/feature requests.

For suggestions/questions, email feedback@talmud.page.

## Development

### Dependencies

- Python 3.11
    - To install Python dependencies, run
      `virtualenv venv && chmod +x venv/bin/activate && source venv/bin/activate && pip install -r requirements.txt`
- `pre-commit`
    - [Pre-Commit](https://pre-commit.com) simplifies configuring Git pre-commit hooks. This is optional but recommended - otherwise you may see errors when trying to push/merge on Github.
    - To install, run `pip install -g pre-commit && pre-commit install`
- NodeJS v20.8.0 and npm 10.1.0
    - To install JavaScript dependencies, run `npm install`
- eslint
    - `npm install -g eslint`

### Building

To build a local server, run `npm run dev`.

To deploy, run `npm run deploy`. Don't run `gcloud app deploy` directly, as that does not build the parceljs compiled files.
