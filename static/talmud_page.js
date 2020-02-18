var COMMENTARIES = [
  {
    englishName: "Verses",
    hebrewName: 'תנ״ך',
    className: "psukim",
    category: "Tanakh",
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
    englishNamePattern: /(Chidushei Halachot|Chidushei Agadot)/,
    hebrewName: 'מהרש"א',
    className: "maharsha",
  },
  {
    englishName: "Maharshal",
    englishNamePattern: /(Chokhmat Shlomo on .*|Chokhmat Shlomo)/,
    hebrewName: 'מהרש"ל',
    className: "maharshal",
  },
  {
    englishName: "Rosh",
    englishNamePrefix: "Rosh on ",
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
    englishNamePrefix: "Rav Nissim Gaon on ",
    hebrewName: "רבנו נסים",
    className: "rav-nissim-gaon",
  },
  {
    englishName: "Shulchan Arukh",
    englishNamePrefix: "Shulchan Arukh, ",
    hebrewName: "שולחן ערוך",
    className: "shulchan-arukh",
    cssCategory: "ein-mishpat",
    showTitle: true,
  },
  {
    englishName: "Mishneh Torah",
    englishNamePrefix: "Mishneh Torah, ",
    hebrewName: "משנה תורה",
    className: "mishneh-torah",
    cssCategory: "ein-mishpat",
    showTitle: true,
  },
  /*{
    englishName: "Sefer Mitzvot Gadol",
    hebrewName: "סמ\"ג",
    className: "smag",
    cssCategory: "ein-mishpat",
  },*/
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

var _concat = function(list1, list2) {
  var result = [];
  if (list1) result.push(...list1);
  if (list2) result.push(...list2);
  return result;
}

var matchingCommentaryKind = function(commentary) {
  var name = commentary.collectiveTitle.en;
  for (var i in COMMENTARIES) {
    var kind = COMMENTARIES[i];
    if (name === kind.englishName
        || name.startsWith(kind.englishNamePrefix)
        || commentary.category === kind.category
        || commentary.type === kind.type
        || (kind.englishNamePattern && name.match(kind.englishNamePattern))) {
      return kind;
    }
  }
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

  var cellClasses = [];
  if ((isEmptyText(hebrew) || isEmptyText(english)) &&
     !options.overrideFullRow) {
    cellClasses.push("fullRow");
  }
  return [
    `<div class="${classes.join(" ")}">`,
    hebrewCell(hebrew || "", cellClasses),
    englishCell(english || "", cellClasses),
    "</div>"
  ].join("");
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
        // TODO: make this non line-clampable
        isEmptyText(comment.text) ? "" : `<strong>${comment.sourceRef}</strong>`,
        commentRowOptions));
  }

  console.log(comment);

  if (comment.he.length && comment.text.length
      && comment.he.length === comment.text.length) {
    for (var i = 0; i < comment.he.length; i++) {
      output.push(tableRow(comment.he[i], comment.text[i], commentRowOptions));
    }
  } else {
    output.push(
      tableRow(
        stringOrListToString(comment.he),
        stringOrListToString(comment.text),
        commentRowOptions));
  }

  return output.join("");
}

var commentaryRowOutput = function(sectionLabel, commentaries) {
  var output = []

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
          {overrideFullRow: true}));

      commentary.forEach(comment => output.push(commentRow(sectionLabel, comment, commentaryKind)));
    }
  }
  output.push(tableRow(showButtons.join(""), "", {overrideFullRow: true}));
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

    // create a function that captures the loop variables
    var createShowHide = function(show, showButton, hideButton, commentaryRows) {
      return function() {
        setVisibility(showButton, show);
        setVisibility(hideButton.parents(".table-row"), !show);
        setVisibility(commentaryRows, !show);

        var sectionShowButtons = showButton.parent().children();
        for (var j = 0; j < sectionShowButtons.length; j++) {
          if ($(sectionShowButtons[j]).css("display") !== "none") {
            showButton.parent().parent().show();
            return;
          }
        }
        showButton.parent().parent().hide();
      }
    }

    showButton.click(createShowHide(false, showButton, hideButton, commentaryRows));
    hideButton.click(createShowHide(true, showButton, hideButton, commentaryRows));
    showButton.on('keypress', clickIfEnter(hideButton));
    hideButton.on('keypress', clickIfEnter(showButton));

    hideButton.click();

    var evaluateEnglishHeights = function(commentaryRows) {
      return function() {
        if (this.shown) {
          return;
        }
        for (var j = 0; j < commentaryRows.length; j++) {
          setMaxLines($(commentaryRows[j]));
        }
      }
    }
    showButton.click(evaluateEnglishHeights(commentaryRows));
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
  for (var i = 0; i < amud.he.length; i++) {
    var sectionLabel = `${amud.id}_section_${i+1}`;

    output.push(
      tableRow(
        `<div class="gemara" id="${sectionLabel}">${amud.he[i]}</div>`, amud.text[i]));

    var commentaries = amud.commentaryIndex[`${amud.book} ${amud.id}:${i+1}`];
    if (commentaries) {
      output.push(commentaryRowOutput(sectionLabel, commentaries));
    }
  }
  return output.join("");
}

/*
for (var i = 0; i < gemaras.length; i++) {
  var viewTop = $(gemaras[i]).offset().top;
  // console.log(viewTop, window.visualViewport.pageTop, window.visualViewport.height);
  if (viewTop >= window.visualViewport.pageTop && viewTop <= window.visualViewport.pageTop + window.visualViewport.height) {
    console.log($(gemaras[i]).text());
  }
}
*/

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
  $.ajax({url: `https://www.sefaria.org/api/texts/${metadata.masechet}.${amud}?commentary=1&context=1&pad=0&wrapLinks=1&multiple=0`,
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

var IGNORED_COMMENTARY_KINDS = new Set(["Responsa", "Philosophy", "Musar", "Chasidut"]);

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
  var amudimIds = [];
  amud.id = amud["toSections"][0]; // "2a"
  amud.commentaryIndex = {}
  for (var i = 0; i < amud.commentary.length; i++) {
    var commentary = amud.commentary[i];
    if (isEmptyText(commentary.he) && isEmptyText(commentary.text)) {
      continue;
    }
    var id = commentary["anchorRefExpanded"][0];
    if (!amud.commentaryIndex[id]) {
      amud.commentaryIndex[id] = {};
    }
    var sectionCommentary = amud.commentaryIndex[id];
    var commentaryKind = matchingCommentaryKind(commentary);
    // TODO: quotation
    // TODO: Steinsaltz
    if (!commentaryKind) {
      if (!IGNORED_COMMENTARY_KINDS.has(commentary.category)) {
        // type = mesorat hashas and category = Tanakh should be aggregating commentary types
        console.log(commentary["collectiveTitle"]["en"], commentary["category"], commentary["type"]);
      }
      continue;
    }
    var commentaryName = commentaryKind.englishName;
    if (!sectionCommentary[commentaryName]) {
      sectionCommentary[commentaryName] = [];
    }
    sectionCommentary[commentaryName].push(commentary);
  }

  amudSectionMap[amud.id] = amud;

  $(divId).html(createAmudTable(amud));
  amudimIds.push(`#amud-${amud.id}`);

  var amudimDivs = $(amudimIds.join(","));
  setCommentaryButtons(amudimDivs);
  setEnglishClickListeners(amudimDivs);

  onceDocumentReady.execute(function() {
    var englishTexts = amudimDivs.find(".english-div");
    // this works because we set everything to be line-clamp=1 to default, so there will only be == 1
    globalEnglishLineHeight = $(englishTexts[0]).height();
    var rows = amudimDivs.find(".table-row");
    for (var j = 0; j < rows.length; j++) {
      var row = $(rows[j])[0];
      var hebrewHeight = $(row).find(".hebrew").height();
      setMaxLines($(row));
    }
  });
};

var globalEnglishLineHeight = -1;

var setMaxLines = function(row) {
  var hebrew = $(row.children()[0])
  var english = $(row.find(".english-div")[0])
  var maxLines = Math.floor(hebrew.height() / globalEnglishLineHeight);
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
        if (location.hash.length > 0) {
          setTimeout(() => setWindowTop(location.hash), 10);
        }
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

$(document).ready(main);
