# https://talmud.page

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
- Expands common abbreviations in Jastrow

## Feedback

Feel free to send commits or open issues for bugs/feature requests.

For suggestions/questions, email feedback@talmud.page.

## Development

To deploy, run `npm run deploy`. Don't run `gcloud app deploy` directly, as that does not build the parceljs compiled files.
