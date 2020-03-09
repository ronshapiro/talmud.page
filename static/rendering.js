jQuery.fn.extend({
  betterDoubleClick: function(fn) {
    if (!!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform)) {
      this.click(function(event) {
        var lastTime = this.lastTime || 0;
        var now = new Date().getTime();
        if (now - lastTime <= 1000) {
          fn(event);
          this.lastTime = 0;
        } else {
          this.lastTime = now;
        }
      });
    } else {
      this.dblclick(fn);
    }
    return this;
  }
});

var COMMENTARIES = [
  {
    englishName: "Translation",
    hebrewName: "Translation",
    className: "translation",
  },
  {
    englishName: "Verses",
    hebrewName: 'תנ״ך',
    className: "psukim",
    showTitle: true,
  },
  {
    englishName: "Mishnah",
    hebrewName: "משנה",
    className: "mishna",
    showTitle: true,
  },
  {
    englishName: "Tosefta",
    hebrewName: "תוספתא",
    className: "tosefta",
    showTitle: true,
  },
  {
    englishName: "Rashi",
    hebrewName: 'רש"י',
    className: "rashi",
  },
  {
    englishName: "Tosafot",
    hebrewName: "תוספות",
    className: "tosafot"
  },
  {
    englishName: "Ramban",
    hebrewName: 'רמב״ן',
    className: "ramban"
  },
  {
    englishName: "Rashba",
    hebrewName: 'רשב״א',
    className: "rashba"
  },
  {
    englishName: "Maharsha",
    hebrewName: 'מהרש"א',
    className: "maharsha",
  },
  {
    englishName: "Maharshal",
    hebrewName: 'מהרש"ל',
    className: "maharshal",
  },
  {
    englishName: "Rosh",
    hebrewName: 'רא"ש',
    className: "rosh",
  },
  {
    englishName: "Ritva",
    hebrewName: 'ריטב"א',
    className: "ritva",
  },
  {
    englishName: "Rav Nissim Gaon",
    hebrewName: "רבנו נסים",
    className: "rav-nissim-gaon",
  },
  {
    englishName: "Shulchan Arukh",
    hebrewName: "שולחן ערוך",
    className: "shulchan-arukh",
    cssCategory: "ein-mishpat",
    showTitle: true,
  },
  {
    englishName: "Mishneh Torah",
    hebrewName: "משנה תורה",
    className: "mishneh-torah",
    cssCategory: "ein-mishpat",
    showTitle: true,
  },
  {
    englishName: "Mesorat Hashas",
    type: "mesorat hashas",
    hebrewName: 'מסורת הש״ס',
    className: "mesorat-hashas",
    showTitle: true,
  },
  {
    englishName: "Jastrow",
    hebrewName: "Jastrow",
    className: "jastrow",
  },
];

var STEINSALTZ = {
  englishName: "Steinsaltz",
  hebrewName: "שטיינזלץ",
  className: "translation",
};

if (localStorage.showTranslationButton === "yes") {
  COMMENTARIES.push(STEINSALTZ);
} else {
  COMMENTARIES.unshift(STEINSALTZ);
}

var _concat = function(list1, list2) {
  var result = [];
  if (list1) result.push(...list1);
  if (list2) result.push(...list2);
  return result;
}

var makeCell = function(text, dir, classes) {
  classes = classes || [];
  classes.push("table-cell");
  var classAttribute = classes ? `class="${classes.join(" ")}"` : "";
  return `<div dir="${dir}" ${classAttribute}>${text}</div>`;
}

var hebrewCell = function(text, classes) {
  return makeCell(text, "rtl", _concat(["hebrew"], classes));
}

var englishCell = function(text, classes) {
  return makeCell(
    `<div class="english-div line-clampable" style="-webkit-line-clamp: 1;">`
      + text
      + `</div>`,
    "ltr",
    _concat(["english"], classes));
}

var tableRow = function(hebrew, english, options) {
  options = options || {};
  var classes = _concat(["table-row"], options.classes);

  var output = [`<div class="${classes.join(" ")}">`];

  var cellClasses = [];

  if ((isEmptyText(hebrew) || isEmptyText(english)) &&
     !options.overrideFullRow) {
    cellClasses.push("fullRow");
  }

  if (!isEmptyText(hebrew)) {
    output.push(hebrewCell(hebrew, cellClasses));
  }

  if (!isEmptyText(english)) {
    output.push(englishCell(english, cellClasses));
  }

  output.push("</div>");
  return output.join("");
};

var isEmptyText = function(stringOrList) {
  return !stringOrList || stringOrList === "" || stringOrList.length == 0;
}

var stringOrListToString = function(stringOrList) {
  return typeof stringOrList === "string"
    ? stringOrList
    : stringOrList.join("<br>");
}

var commentRow = function(sectionLabel, comment, commentaryKind) {
  var output = [];

  var commentRowOptions = {
    classes: [`${sectionLabel}-${commentaryKind.className}`, "commentaryRow"],
  };

  if (commentaryKind.showTitle) {
    output.push(
      tableRow(
        `<strong>${comment.sourceHeRef}</strong>`,
        isEmptyText(comment.en) ? "" : `<strong>${comment.sourceRef}</strong>`,
        commentRowOptions));
  }

  if (Array.isArray(comment.he) && Array.isArray(comment.en)
      && comment.he.length === comment.en.length) {
    for (var i = 0; i < comment.he.length; i++) {
      output.push(tableRow(comment.he[i], comment.en[i], commentRowOptions));
    }
  } else {
    output.push(
      tableRow(
        stringOrListToString(comment.he),
        stringOrListToString(comment.en),
        commentRowOptions));
  }

  return output.join("");
}

var commentaryRowOutput = function(sectionLabel, commentaries) {
  var output = []

  var tableRowOptions = translationOption !== "english-side-by-side" ? {} : {overrideFullRow: true};
  var showButtons = [];
  for (var i in COMMENTARIES) {
    var commentaryKind = COMMENTARIES[i];
    var commentary = commentaries[commentaryKind.englishName];

    if (commentary) {
      var classes = ["commentary_header", commentaryKind.className, commentaryKind.cssCategory].join(" ");
      var extraAttrs = `tabindex="0" data-commentary="${commentaryKind.englishName}" data-section-label="${sectionLabel}"`
      var idPrefix = `${sectionLabel}-${commentaryKind.className}`;
      showButtons.push(`<a id="${idPrefix}-show-button" class="${classes} show-button" ${extraAttrs}>${commentaryKind.hebrewName}</a>`);
      output.push(
        tableRow(
          `<a id="${idPrefix}-hide-button" class="${classes}" ${extraAttrs}>${commentaryKind.hebrewName}</a>`,
          "",
          tableRowOptions));

      commentary.forEach(comment => output.push(commentRow(sectionLabel, comment, commentaryKind)));
    }
  }
  output.push(tableRow(showButtons.join(""), "", tableRowOptions));
  return output.join("");
}

var setVisibility = function(element, toShow) {
  if (toShow) {
    element.show();
  } else {
    element.hide();
  }
}

var clickIfEnter = function(alternateButton) {
  return function(event) {
    if (!event || event.originalEvent.code !== "Enter") return;
    event.target.click();
    alternateButton.focus();
  }
}

var setCommentaryButtons = function(amud) {
  var showButtons = amud.find(".show-button");
  for (var i = 0; i < showButtons.length; i++) {
    var showButton = showButtons[i];
    var label = showButton.id.replace("-show-button", "");
    showButton = $(showButton); // after using .id to get the label, convert to a jQuery object
    var hideButton = amud.find(`#${label}-hide-button`);
    var commentaryRows = amud.find(`.commentaryRow.${label}`);

    // these functions need to capture the loop variables
    var setShownState = function(showButton, hideButton, commentaryRows) {
      return function(show) {
        setVisibility(showButton, !show);
        setVisibility(hideButton.parents(".table-row"), show);
        setVisibility(commentaryRows, show);
      }
    }(showButton, hideButton, commentaryRows);

    setShownState(false);

    var clickListener = function(setShownState, commentaryRows, label) {
      var show = false;
      var maxLinesEvaluated = false;
      return function(event) {
        show = !show;
        setShownState(show);

        if (show && !maxLinesEvaluated) {
          maxLinesEvaluated = true;
          for (var j = 0; j < commentaryRows.length; j++) {
            setMaxLines($(commentaryRows[j]));
          }
        }
        var element = $(event.toElement);
        gtag("event", show ? "commentary_viewed" : "commentary_hidden", {
          // these two || alternatives are kinda hacks, but they do the job for now
          commentary: element.data("commentary") || "<translation>",
          section: element.data("section-label") || label.replace("-translation", ""),
        });
      }
    }(setShownState, commentaryRows, label);

    showButton.click(clickListener);
    hideButton.click(clickListener);
    showButton.on('keypress', clickIfEnter(hideButton));
    hideButton.on('keypress', clickIfEnter(showButton));

    if (showButton.hasClass("translation")) {
      showButton.closest(".section-container").find(".gemara").betterDoubleClick(clickListener);
      if (localStorage.showTranslationButton !== "yes") {
        showButton.remove();
        hideButton.remove();
      }
    }
  }
};

var setEnglishClickListeners = function(amudim) {
  var sections = amudim.find(".english-div");
  for (var i = 0; i < sections.length; i++) {
    var section = $(sections[i]);
    section.betterDoubleClick(englishClickListener(section));
  }
};

var englishClickListener = function(element) {
  return function() {
    element.toggleClass("line-clampable");
  };
}

var createAmudTable = function(amud) {
  var output = [`<h2>${amud.title}</h2>`];
  for (var i = 0; i < amud.sections.length; i++) {
    var section = amud.sections[i];
    var sectionLabel = `${amud.id}_section_${i+1}`;
    output.push(`<div id="${sectionLabel}" class="section-container">`);

    output.push(
      tableRow(
        `<div class="gemara" id="${sectionLabel}-gemara">${section.he}</div>`,
        translationOption === "english-side-by-side" ? section.en : undefined));

    var commentaries = section.commentary;

    if (commentaries) {
      if (translationOption === "both") {
        commentaries.Translation = commentaries.Steinsaltz;
        if (commentaries.Translation) {
          // e.g. Hadran sections have no steinsaltz
          commentaries.Translation[0].en = section.en;
        }
        delete commentaries.Steinsaltz;
      }
      output.push(commentaryRowOutput(sectionLabel, commentaries));
    }
    output.push("</div>");
  }
  return output.join("");
}

var amudSectionMap = {}

var onceDocumentReady = {
  ready: false,
  queue: [],
  execute: function(fn) {
    if (this.ready) {
      fn();
      return;
    }
    this.queue.push(fn);
  },
  declareReady: function() {
    if (this.ready) {
      throw "Already ready!";
    }
    this.ready = true;
    this.queue.forEach(fn => fn());
  },
}

var renderNewResults = function(amud, divId) {
  amudSectionMap[amud.id] = amud;

  $(divId).html(createAmudTable(amud));

  var amudDiv = $(`#amud-${amud.id}`);
  setCommentaryButtons(amudDiv);
  setEnglishClickListeners(amudDiv);

  onceDocumentReady.execute(function() {
    var englishTexts = amudDiv.find(".english-div");
    // this works because the view has 1 character, so the height should be == 1 line.
    var rows = amudDiv.find(".table-row");
    for (var j = 0; j < rows.length; j++) {
      var row = $(rows[j])[0];
      var hebrewHeight = $(row).find(".hebrew").height();
      setMaxLines($(row));
    }

    // Make sure mdl always registers new views correctly
    componentHandler.upgradeAllRegistered();
  });
};

var setMaxLines = function(row) {
  var hebrew = $(row.children()[0])
  var english = $(row.find(".english-div")[0])
  var maxLines = Math.floor(hebrew.height() / english.height());
  english.css("-webkit-line-clamp", maxLines.toString());
}
