var COMMENTARIES = [
  // "verses",
  {
    englishName: "Rashi",
    hebrewName: 'רש"י',
    className: "rashi"
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
    englishName: "Ritva",
    hebrewName: 'ריטב"א',
    className: "ritva",
  },
  {
    englishName: "Shulchan Arukh",
    englishNamePrefix: "Shulchan Arukh, ",
    hebrewName: "שולחן ערוך",
    className: "shulchan-arukh"
  },
  {
    englishName: "Mishneh Torah",
    englishNamePrefix: "Mishneh Torah, ",
    hebrewName: "משנה תורה",
    className: "mishneh-torah",
  },
  {
    englishName: "Sefer Mitzvot Gadol",
    hebrewName: "סמ\"ג",
    className: "smag",
  }
];

var matchingCommentaryKind = function(name) {
  for (var i in COMMENTARIES) {
    var kind = COMMENTARIES[i];
    if (name === kind.englishName || name.startsWith(kind.englishNamePrefix)) {
      return kind;
    }
  }
}

var commentRow = function(sectionLabel, comment, commentaryKind) {
  var english = typeof comment.text === "string" ? comment.text : comment.text.join("<br>");
  return `<tr class="${sectionLabel}-${commentaryKind.className} commentaryRow">`
    + `<td dir="rtl" class="hebrew">${comment.he}</td>`
    + `<td class="english"><div class="english-div line-clampable" style="-webkit-line-clamp: 1;">${english}</div></td>`
    + `</tr>`;
}

var commentaryRowOutput = function(sectionLabel, commentaries) {
  var output = [`<tr><td dir="rtl" class="hebrew">`];
  var commentaryRows = [];

  for (var i in COMMENTARIES) {
    var commentaryKind = COMMENTARIES[i];
    var commentary = commentaries[commentaryKind.englishName];
    if (commentary) {
      output.push(`<a id="${sectionLabel}-${commentaryKind.className}-show-button" class="commentary_header show-button">${commentaryKind.hebrewName}</a>`);
      commentaryRows.push(
        `<tr>`
          + `<td dir="rtl" class="hebrew">`
          + `  <a id="${sectionLabel}-${commentaryKind.className}-hide-button" class="commentary_header">${commentaryKind.hebrewName}</a></td>`
          + "</tr>");

      commentary.forEach(comment => commentaryRows.push(commentRow(sectionLabel, comment, commentaryKind)));
    }
  }
  output.push("</td></tr>");
  output.push(commentaryRows.join(""));
  return output.join("");
}

var setVisibility = function(element, toShow) {
  if (toShow) {
    element.show();
  } else {
    element.hide();
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
        setVisibility(hideButton, !show);
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
    section.click(englishClickListener(section));
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
  var output = [
    `<div id="amud-${amud.id}">`,
    "<table>",
    `<h2>${amud.title}</h2>`];
  for (var i = 0; i < amud.he.length; i++) {
    var sectionLabel = `${amud.id}_section_${i+1}`;

    output.push("<tr>");
    output.push(`<td dir="rtl" class="hebrew"><div class="gemara" id="${sectionLabel}">${amud.he[i]}</div></td>`);    
    output.push(`<td dir="ltr" class="english"><div class="english-div line-clampable" style="-webkit-line-clamp: 1;">${amud.text[i]}</div></td>`);
    output.push("</tr>");

    // TODO: hebrew.push(commentarySection(referencedVersesAsLines(section), "verses"));
    var commentaries = amud.commentaryIndex[`${amud.book} ${amud.id}:${i+1}`];
    if (commentaries) {
      output.push(commentaryRowOutput(sectionLabel, commentaries));
    }
  }
  output.push("</table></div>");
  return output.join("");
}

var amudSectionMap = {}

var renderNewResults = function(amud, directionFunction) {
  var amudimIds = [];
  amud.id = amud["toSections"][0]; // "2a"
  amud.commentaryIndex = {}
  for (var i = 0; i < amud.commentary.length; i++) {
    var commentary = amud.commentary[i];
    var id = commentary["anchorRefExpanded"][0];
    if (!amud.commentaryIndex[id]) {
      amud.commentaryIndex[id] = {};
    }
    var sectionCommentary = amud.commentaryIndex[id];
    var commentaryKind = matchingCommentaryKind(commentary["collectiveTitle"]["en"]);
    if (!commentaryKind) {
      // type = mesorat hashas and category = Tanakh should be aggregating commentary types
      console.log(commentary["collectiveTitle"]["en"], commentary["category"], commentary["type"]);
      continue;
    }
    var commentaryName = commentaryKind.englishName;
    if (!sectionCommentary[commentaryName]) {
      sectionCommentary[commentaryName] = [];
    }
    sectionCommentary[commentaryName].push(commentary);
  }
  
  amudSectionMap[amud.id] = amud;
  
  $("#results")[directionFunction](createAmudTable(amud));
  amudimIds.push(`#amud-${amud.id}`);

  var amudimDivs = $(amudimIds.join(","));
  setCommentaryButtons(amudimDivs);
  setEnglishClickListeners(amudimDivs);

  var englishTexts = amudimDivs.find(".english-div");
  // this works because we set everything to be line-clamp=1 to default, so there will only be == 1
  globalEnglishLineHeight = $(englishTexts[0]).height();
  var rows = amudimDivs.find("tr");
  for (var j = 0; j < rows.length; j++) {
    var row = $(rows[j])[0];
    var hebrewHeight = $(row).find(".hebrew").height();
    setMaxLines($(row));
  }
};

var globalEnglishLineHeight = -1;

var setMaxLines = function(row) {
  var hebrew = $(row.children()[0])
  var english = $(row.find(".english-div")[0])
  var maxLines = Math.floor(hebrew.height() / globalEnglishLineHeight);
  english.css("-webkit-line-clamp", maxLines.toString());
}

var amudMetadata = function() {
  var pathParts = location.pathname.split("/");
  return {
    masechet: pathParts[1],
    amudStart: pathParts[2],
    amudEnd: pathParts[4] || pathParts[2],
  }
}

var refreshPageState = function() {
  setHtmlTitle();

  var metadata = amudMetadata();
  setVisibility($("#previous-amud-container"), metadata.amudStart !== "2a");
  setVisibility($("#next-amud-container"), true);
}

var setHtmlTitle = function() {
  var metadata = amudMetadata();
  var title = metadata.masechet + " " + metadata.amudStart;
  if (metadata.amudStart != metadata.amudEnd) {
    title += "-" + metadata.amudEnd;
  }
  document.title = title;
}

var moveSnackbarOffscreen = () => $("#snackbar").css("bottom", -400);
var hideSnackbar = () => $("#snackbar").animate({"bottom": -400});

var updateSnackbar = function(labelHtml, buttons) {
  $("#snackbar-text").html(labelHtml);
  var buttonsDiv = $("#snackbar-buttons").html("");
  if (!buttons) {
    buttons = [];
  } else if (!buttons.length) {
    buttons = [buttons];
  }
  for (var i in buttons) {
    var button = buttons[i]
    buttonsDiv.append(
      `<button class="mdl-button mdl-js-button mdl-button--accent">${button.text}</button>`);
  }

  var buttonElements = $("#snackbar-buttons button");
  for (var i = 0; i < buttonElements.length; i++) {
    $(buttonElements[i]).click(buttons[i].onClick);
  }
}

var displaySnackbar = function(labelHtml, buttons) {
  updateSnackbar(labelHtml, buttons);

  moveSnackbarOffscreen();
  $("#snackbar").animate({"bottom": 0});
}

var getAncestorClasses = function(node) {
  var nodes = getAncestorNodes(node);
  var classes = [];
  for (var i in nodes) {
    for (var j = 0; j < nodes[i].classList.length; j++) {
      classes.push(nodes[i].classList[j]);
    }
  }
  return classes;
}

var getAncestorNodes = function(node) {
  var nodes = [];
  while (node !== document) {
    nodes.push(node);
    node = node.parentNode;
  }
  return nodes;
}

var hasClass = function(node, clazz) {
  for (var i = 0; i < node.classList.length; i++) {
    if (node.classList[i] === clazz) {
      return true;
    }
  }
  return false;
}

var ancestorWithClass = function(node, clazz) {
  var ancestors = getAncestorNodes(node);
  for (var i in ancestors) {
    var ancestor = ancestors[i];
    if (hasClass(ancestor, clazz)) {
      return ancestor;
    }
  }
}

var onSelectionChange = function() {
  var selection = document.getSelection();
  if (!selection.extentNode) {
    return;
  }
  var node = selection.extentNode.parentNode;
  if (ancestorWithClass(node, "snackbar")) {
    return;
  }

  var text = selection.toString();
  var gemaraSection = ancestorWithClass(node, "gemara");
  if (text !== ""
      && gemaraSection
      && amudSectionMap[gemaraSection.id].quotedVerses.length > 0) {
    displaySnackbar("", {
      text: "Verses",
      onClick: () => {
        var snackbarText = [];
        var verses = amudSectionMap[gemaraSection.id].quotedVerses;

        for (var i in verses) {
          var verse = verses[i];
          snackbarText.push(`<p class="hebrew" dir="rtl">${verse.hebrew} <small>(${verse.label.hebrew})</small></p>`);
        }
        updateSnackbar(snackbarText.join(""), {text: "Hide", onClick: hideSnackbar});
      },
    });
  } else {
    hideSnackbar();
  }
}

var main = function() {
  moveSnackbarOffscreen();
  // TODO: revisit how to implement the selection+snackbar on Android without triggering contextual search
  // document.addEventListener("selectionchange", onSelectionChange);

  var metadata = amudMetadata();
  var url = `https://www.sefaria.org/api/texts/${metadata.masechet}.${metadata.amudStart}?commentary=1&context=1&pad=0&wrapLinks=1&multiple=0`;
  $.ajax({url: url,
          type: "GET",
          success: function(results) {
            renderNewResults(results, "append");
            if (location.hash.length > 0) {
              setTimeout(() => setWindowTop(location.hash), 10);
            }
            refreshPageState();
          }});
  refreshPageState();

  $("#previous-amud-con tainer").click(addPreviousAmud);
  $("#next-amud-container").click(addNextAmud);
}

var addNextAmud = function() {
  var metadata = amudMetadata();
  // TODO: hardcode final amudim
  var end = metadata.amudEnd;
  var number = parseInt(end);
  var nextAmud = end.endsWith("a") ? number + "b" : (number + 1) + "a";
  $.ajax({url: `${location.origin}/${metadata.masechet}/${nextAmud}/json`,
          type: "GET",
          success: results => renderNewResults(results, "append")});
  history.pushState(
    {}, "", `${location.origin}/${metadata.masechet}/${metadata.amudStart}/to/${nextAmud}`);
  refreshPageState();
}

var addPreviousAmud = function() {
  var metadata = amudMetadata();
  if (metadata.amudStart === "2a") return;
  var start = metadata.amudStart;
  var number = parseInt(start);
  var previousAmud = start.endsWith("b") ? number + "a" : (number - 1) + "b";
  $.ajax({url: `${location.origin}/${metadata.masechet}/${previousAmud}/json`,
          type: "GET",
          success: function(results) {
            renderNewResults(results, "prepend");
            setTimeout(() => setWindowTop("#amud-" + start), 10);
          }});
  history.pushState(
    {}, "", `${location.origin}/${metadata.masechet}/${previousAmud}/to/${metadata.amudEnd}`);
  refreshPageState();
}

var setWindowTop = function(selector) {
  $(document.body).animate({scrollTop: $(selector).offset().top}, 0);
}

$(document).ready(main);
