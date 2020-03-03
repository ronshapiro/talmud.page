var translationOption = localStorage.translationOption || "both";
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
  {
    englishName: "Steinsaltz",
    hebrewName: "שטיינזלץ",
    className: "translation",
  }
];

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

  if (comment.he === comment.en) {
    // TODO: move to server
    // Fix an issue where sometimes Sefaria returns the exact same text. For now, safe to assume
    // that the equivalent text is Hebrew
    comment.en = "";
  }

  if (commentaryKind.showTitle) {
    output.push(
      tableRow(
        `<strong>${comment.sourceHeRef}</strong>`,
        // TODO: make this non line-clampable
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
      var idPrefix = `${sectionLabel}-${commentaryKind.className}`;
      showButtons.push(`<a id="${idPrefix}-show-button" class="${classes} show-button" tabindex="0">${commentaryKind.hebrewName}</a>`);
      output.push(
        tableRow(
          `<a id="${idPrefix}-hide-button" class="${classes}" tabindex="0">${commentaryKind.hebrewName}</a>`,
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

var setCommentaryButtons = function(amudim) {
  var showButtons = amudim.find(".show-button");
  for (var i = 0; i < showButtons.length; i++) {
    var showButton = showButtons[i];
    var label = showButton.id.replace("-show-button", "");
    showButton = $(showButton); // after using .id to get the label, convert to a jQuery object
    var hideButton = amudim.find(`#${label}-hide-button`);
    var commentaryRows = amudim.find(`.commentaryRow.${label}`);

    // these functions need to capture the loop variables
    var setShownState = function(showButton, hideButton, commentaryRows) {
      return function(show) {
        setVisibility(showButton, !show);
        setVisibility(hideButton.parents(".table-row"), show);
        setVisibility(commentaryRows, show);
      }
    }(showButton, hideButton, commentaryRows);

    setShownState(false);

    var clickListener = function(setShownState, commentaryRows) {
      var show = false;
      var maxLinesEvaluated = false;
      return function() {
        show = !show;
        setShownState(show);

        if (show && !maxLinesEvaluated) {
          maxLinesEvaluated = true;
          for (var j = 0; j < commentaryRows.length; j++) {
            setMaxLines($(commentaryRows[j]));
          }
        }
      }
    }(setShownState, commentaryRows);

    showButton.click(clickListener);
    hideButton.click(clickListener);
    showButton.on('keypress', clickIfEnter(hideButton));
    hideButton.on('keypress', clickIfEnter(showButton));

    if (showButton.hasClass("translation")) {
      showButton.closest(".section-container").find(".gemara").dblclick(clickListener);
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
    section.dblclick(englishClickListener(section));
  }
};

var englishClickListener = function(element) {
  return function() {
    element.toggleClass("line-clampable");
  };
}

var referencedVersesAsLines = function(section) {
  return section.quotedVerses.map(verse => `${verse.hebrew} <small>(${verse.label.hebrew})</small>`);
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
        commentaries.Translation[0].en = section.en;
        delete commentaries.Steinsaltz;
      }
      output.push(commentaryRowOutput(sectionLabel, commentaries));
    }
    output.push("</div>");
  }
  return output.join("");
}

var amudSectionMap = {}

var requestAmud = function(amud, directionFunction, options) {
  var divId = `amud-${amud}`;
  var spinner = undefined;
  if (directionFunction === "prepend") {
    spinner = $("#previous-spinner");
  } else if (directionFunction === "append") {
    spinner = $("#next-spinner");
  } else {
    throw "Invalid directionFunction: " + directionFunction;
  }
  spinner = spinner.show();
  $("#results")[directionFunction](`<div id="${divId}" class="amudContainer">`);
  var metadata = amudMetadata();
  $.ajax({url: `${location.origin}/api/${metadata.masechet}/${amud}`,
          type: "GET",
          success: function(results) {
            renderNewResults(results, "#" + divId);
            refreshPageState();
            spinner.hide();
            if (options.callback) options.callback();
          }});
  if (options.newUrl) history.pushState({}, "", options.newUrl);
  refreshPageState();
}

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
  });
};

var setMaxLines = function(row) {
  var hebrew = $(row.children()[0])
  var english = $(row.find(".english-div")[0])
  var maxLines = Math.floor(hebrew.height() / english.height());
  english.css("-webkit-line-clamp", maxLines.toString());
}

var computePreviousAmud = function(current) {
  var number = parseInt(current);
  return current.endsWith("b") ? number + "a" : (number - 1) + "b";
}

var computeNextAmud = function(current) {
  var number = parseInt(current);
  return current.endsWith("a") ? number + "b" : (number + 1) + "a";
}

var amudMetadata = function() {
  var pathParts = location.pathname.split("/");
  return {
    masechet: pathParts[1],
    amudStart: pathParts[2],
    amudEnd: pathParts[4] || pathParts[2],
    range: function() {
      var current = this.amudStart;
      var results = [current];
      while (current !== this.amudEnd) {
        current = computeNextAmud(current);
        results.push(current);
      }
      return results;
    }
  }
}

var refreshPageState = function() {
  setHtmlTitle();

  onceDocumentReady.execute(function() {
    var metadata = amudMetadata();
    // Note that these may still be hidden by their container if the full page hasn't loaded yet.
    setVisibility($("#previous-amud-container"), metadata.amudStart !== "2a");
    setVisibility($("#next-amud-container"), true);

    $("#previous-amud-button").text(`Load ${computePreviousAmud(metadata.amudStart)}`);
    $("#next-amud-button").text(`Load ${computeNextAmud(metadata.amudEnd)}`);
  });
}

var setHtmlTitle = function() {
  var metadata = amudMetadata();
  var title = metadata.masechet + " " + metadata.amudStart;
  if (metadata.amudStart != metadata.amudEnd) {
    title += "-" + metadata.amudEnd;
  }
  document.title = title;
}

var main = function() {
  var amudRange = amudMetadata().range();
  var $results = $("#results");
  $results.hide();
  $("#previous-spinner").hide();

  var requestOptions = {
    counter: 0,
    pageCount: amudRange.length,
    callback: function() {
      this.counter++;
      if (this.counter === this.pageCount) {
        $results.show();
        $("#next-spinner").hide();

        var scrollToSection = location.hash;
        if (scrollToSection.length === 0) {
          var savedSection = "#" + localStorage.restoreSectionOnRefresh;
          if ($(savedSection).length) {
            scrollToSection = savedSection;
          }
        }
        if (scrollToSection.length > 0) {
          setTimeout(() => setWindowTop(scrollToSection), 10);
        }

        setInterval(function() {
          var section = firstFullyOnScreenSection();
          if (section) {
            localStorage.setItem("restoreSectionOnRefresh", section.id);
          }
        }, 1000);

        onceDocumentReady.declareReady();
      }
    }
  }
  for (var i in amudRange) {
    requestAmud(amudRange[i], "append", requestOptions);
  }

  $("#previous-amud-container").click(addPreviousAmud);
  $("#next-amud-container").click(addNextAmud);
}

var addNextAmud = function() {
  var metadata = amudMetadata();
  // TODO: hardcode final amudim
  var nextAmud = computeNextAmud(metadata.amudEnd);
  requestAmud(nextAmud, "append", {
    newUrl: `${location.origin}/${metadata.masechet}/${metadata.amudStart}/to/${nextAmud}`
  });
}

var addPreviousAmud = function() {
  var metadata = amudMetadata();
  if (metadata.amudStart === "2a") return;
  var previousAmud = computePreviousAmud(metadata.amudStart);
  requestAmud(previousAmud, "prepend", {
    newUrl: `${location.origin}/${metadata.masechet}/${previousAmud}/to/${metadata.amudEnd}`,
    callback: () => setTimeout(() => setWindowTop("#amud-" + metadata.amudStart), 10)
  });
}

var setWindowTop = function(selector) {
  $("html, body").animate({scrollTop: $(selector).offset().top}, 0);
}

var firstFullyOnScreenSection = function() {
  var sections =
      _concat(
        $(".gemara"),
        $(".amudContainer"),
        $("#previous-amud-container"));
  for (var i = 0; i < sections.length; i++) {
    var viewTop = $(sections[i]).offset().top;
    var pageTop = window.visualViewport.pageTop;
    var pageHeight = window.visualViewport.height;
    if (viewTop >= pageTop && viewTop <= pageTop + pageHeight) {
      return sections[i];
    }
  }
}

$(document).ready(main);
