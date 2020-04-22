// TODO: maybe this should live in snackbar?
var PREFERENCES_PAGE_VERSION = 1;

var TRANSLATION_OPTIONS = [
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

var radioSection = function(title, section, items, isCheckedFunction, newValueFunction) {
  var output = [
    `<div id="${section}">`,
    `<h3>${title}</h3>`,
  ];

  for (var i in items) {
    var item = items[i];
    var id = `${section}-${item.value}`;

    var checkedAttribute = isCheckedFunction(item) ? "checked" : "";
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

  $(`#${section} input`).click(function() {
    newValueFunction($(`#${section} :checked`).attr("value"));
  });
}

var main = function() {
  gtag("set", {
    "preferences_page": true,
  });

  onceDocumentReady.declareReady();

  localStorage.lastViewedVersionOfPreferencesPage = PREFERENCES_PAGE_VERSION;
  radioSection("Translation", "translation", TRANSLATION_OPTIONS,
               function(item) {
                 return localStorage.translationOption === item.value;
               },
               function(newValue) {
                 localStorage.translationOption = newValue;
               });

  TRANSLATION_OPTIONS.forEach(option => {
    var divId = `translationOptionExample-${option.value}`;
    $("#translation").append(`<div id="${divId}" class="amudContainer" />`);

    new TalmudRenderer(option.value).renderContainer(
      {
        sections: createTestData(),
        id: option.value,
        title: `Sample: ${option.displayText}`
      },
      divId);
  });

  var showTranslationHeaderText =
      "Show Translation Button <br><small>(translation is always available by double-clicking the "
      + "Hebrew)</small>"
  radioSection(showTranslationHeaderText, "show-translation", [
    {
      value: "yes",
      displayText: "Yes",
    },
    {
      value: "no",
      displayText: "No",
    }], function(item) {
      return localStorage.showTranslationButton === item.value;
    }, function(newValue) {
      localStorage.showTranslationButton = newValue;
    });
};

$(document).ready(main);
