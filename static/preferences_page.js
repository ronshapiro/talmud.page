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
      `<label class="mdl-radio mdl-js-radio mdl-js-ripple-effect" for="${id}">`,
      `  <input ${checkedAttribute} class="mdl-radio__button" id="${id}" name="${section}" type="radio"`,
      `         value="${item.value}">`,
      `  <span class="mdl-radio__label">${item.displayText}</span>`,
      `</label>`);
  }

  output.push("</div>");

  $("#main-contents").append(output.join(""));

  $(`#${section} input`).click(function() {
    newValueFunction($("#translation :checked").attr("value"));
  });
}

var main = function() {
  radioSection("Translation", "translation", TRANSLATION_OPTIONS,
               function(item) {
                 return localStorage.translationOption === item.value;
               },
               function(newValue) {
                 localStorage.translationOption = newValue;
               });
};

$(document).ready(main);
