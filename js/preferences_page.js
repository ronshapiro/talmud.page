/* global gtag, componentHandler */

import {$} from "./jquery";
import {snackbars} from "./snackbar.ts";
import {TalmudRenderer} from "./rendering.jsx";
import {onceDocumentReady} from "./once_document_ready.ts";
import createTestData from "./preferences_sample_data.js";
import PREFERENCES_PAGE_VERSION from "./preferences_version.ts";

const TRANSLATION_OPTIONS = [
  {
    value: "english-side-by-side",
    displayText: "English (side-by-side)",
  },
  {
    value: "both",
    displayText: "English & Hebrew (expandable)",
  },
  {
    value: "just-hebrew",
    displayText: "Hebrew (expandable)",
  },
];

const DARK_MODE_OPTIONS = [
  {
    value: "true",
    displayText: "On",
  },
  {
    value: "false",
    displayText: "Off",
  },
];

const radioSection = (title, section, items, localStorageKeyName) => {
  const output = [
    `<div id="${section}">`,
    `<h3>${title}</h3>`,
  ];

  for (const item of items) {
    const id = `${section}-${item.value}`;

    const checkedAttribute = item.value === localStorage[localStorageKeyName] ? "checked" : "";
    output.push(
      `<div>`,
      `<label class="mdl-radio mdl-js-radio mdl-js-ripple-effect" for="${id}">`,
      `  <input ${checkedAttribute} class="mdl-radio__button" id="${id}" name="${section}" type="radio"`,
      `         value="${item.value}">`,
      `  <span class="mdl-radio__label">${item.displayText}</span>`,
      `</label>`,
      `</div>`);
  }

  output.push("</div>");

  $("#main-contents").append(output.join(""));

  $(`#${section} input`).click(() => {
    const maybeNewValue = $(`#${section} :checked`).attr("value");
    if (maybeNewValue !== localStorage[localStorageKeyName]) {
      localStorage[localStorageKeyName] = maybeNewValue;
      snackbars.preferencesSaved.show("Preferences saved!", [{
        text: "Dismiss",
        onClick: () => snackbars.preferencesSaved.hide(),
      }]);
    }
  });
};

const main = () => {
  gtag("set", {preferences_page: true});

  onceDocumentReady.declareReady();

  localStorage.lastViewedVersionOfPreferencesPage = PREFERENCES_PAGE_VERSION;
  radioSection("Dark Mode", "darkMode", DARK_MODE_OPTIONS, "darkMode");
  radioSection("Translation", "translation", TRANSLATION_OPTIONS, "translationOption");

  TRANSLATION_OPTIONS.forEach(option => {
    const divId = `translationOptionExample-${option.value}`;
    $("#translation").append(`<div id="${divId}" class="amudContainer" />`);

    // Different renderers are used since they each have different rendering options
    const renderer = new TalmudRenderer(
      option.value,
      // TODO: Update the sample views whenever a preference is changed
      localStorage.wrapTranslations !== "false",
      localStorage.expandEnglishByDefault === "true",
      /* navigationExtension= */ undefined);
    renderer.register(divId);
    renderer.setAmud({
      sections: createTestData(),
      id: option.value,
      title: `Sample: ${option.displayText}`,
    });
    renderer.sortedAmudim = () => {
      return [renderer.allAmudim[option.value]];
    };

    renderer.declareReady();
  });

  radioSection(
    `Hide Gemara translation by default
    <em>(only relevant if Translation is set to English & Hebrew (expandable)</em>`,
    "hideGemaraTranslationByDefault", [
      {
        value: "false",
        displayText: "No",
      },
      {
        value: "true",
        displayText: "Yes (double click the Hebrew Steinsaltz to show)",
      },
    ],
    "hideGemaraTranslationByDefault");


  radioSection(
    "Wrap translations around the main text", "wrap-translations", [
      {
        value: "true",
        displayText: "Yes",
      },
      {
        value: "false",
        displayText: "No",
      },
    ],
    "wrapTranslations");

  const showTranslationHeaderText = (
    "Show Translation Button <br><small>(translation is always available by double-clicking the "
      + "Hebrew)</small>"
  );
  radioSection(
    showTranslationHeaderText, "show-translation", [
      {
        value: "yes",
        displayText: "Yes",
      },
      {
        value: "no",
        displayText: "No",
      },
    ],
    "showTranslationButton");

  const expandEnglishByDefaultHeaderText = (
    "Expand English translations by default <br><small>(instead of double clicking to expand the "
      + "translation when it is longer than the Hebrew)</small>"
  );
  radioSection(
    expandEnglishByDefaultHeaderText, "expand-english-by-default", [
      {
        value: "true",
        displayText: "Yes",
      },
      {
        value: "false",
        displayText: "No",
      },
    ],
    "expandEnglishByDefault");

  // Make sure mdl always registers new views correctly
  componentHandler.upgradeAllRegistered();
};

$(document).ready(main);
