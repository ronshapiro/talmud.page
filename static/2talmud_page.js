var COMMENTARIES = ["rashi", "tosafot", "ramban", "rashba"];

var COMMENTARY_DISPLAY_NAMES = {
  "rashi": "רש״י",
  "tosafot": "תוספות",
  "ramban": "רמב״ן",
  "rashba": "רשב״א",
};

var commentarySection = function(lines, commentary) {
  if (!lines.length) {
    return "";
  }
  return [
    `<a class="commentary_header ${commentary}-header">${COMMENTARY_DISPLAY_NAMES[commentary]}</a>`,
    `<div class="${commentary}">`,
    typeof lines === "string" ? lines : lines.join("<br>"),
    '</div>',
  ].join("");
};

var setVisibility = function(element, toShow) {
  if (toShow) {
    element.show();
  } else {
    element.hide();
  }
}

var setCommentaryState = function(amudim) {
  var commentarySections = amudim.find(".commentary");
  for (var i = 0; i < commentarySections.length; i++) {
    var section = $(commentarySections[i]);
    var anyEnabled = false;
    for (var j in COMMENTARIES) {
      var commentary = COMMENTARIES[j];
      var commentarySection = $(section.find(`.${commentary}`)[0]);
      var enabled = commentarySection.attr("commentary-enabled") !== undefined;
      setVisibility(commentarySection, enabled);
      anyEnabled = anyEnabled || enabled;
    }
    section.css("display", anyEnabled ? "block" : "flex");
  }
};

var setCommentaryButtons = function(amudim) {
  var commentarySections = amudim.find(".commentary");
  for (var i = 0; i < commentarySections.length; i++) {
    var section = $(commentarySections[i]);
    for (var j in COMMENTARIES) {
      var commentary = COMMENTARIES[j];
      $(section.find(`.${commentary}-header`)).click(commentaryClickListener(section, `.${commentary}`, amudim));
    }
  }
};

var commentaryClickListener = function(section, targetViewSelector, amudim) {
  return function() {
    var targetView = $(section.find(targetViewSelector)[0]);
    if (targetView.attr("commentary-enabled")) {
      targetView.removeAttr("commentary-enabled");
    } else {
      targetView.attr("commentary-enabled", "true");
    }
    // TODO: find a less-hacky way to pipe this information through (or derive it so that the scope
    // is smaller
    setCommentaryState(amudim);
  }
}

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

var createAmudTable = function(amud) {
  var output = [
    `<div id="amud-${amud.amud}">`,
    "<table>",
    `<h2>${amud.masechet} ${amud.amud}</h2>`];
  for (var i = 0; i < amud.sections.length; i++) {
    var hebrew = [];
    var section = amud.sections[i];
    var sectionLabel = `${amud.amud}.${i+1}`;
    hebrew.push(`<div class="gemara" aria-role="main" id="${sectionLabel}">{section.gemara}</div>`);
    hebrew.push('<div class="commentary">');
    for (var j in COMMENTARIES) {
      var commentary = COMMENTARIES[j];
      hebrew.push(commentarySection(section[commentary], commentary));
    }
    hebrew.push("</div>"); // .commentary

    output.push("<tr>");
    output.push(`<td dir="rtl" class="hebrew">${hebrew.join("")}</td>`);
    output.push(`<td dir="ltr" class="english"><div class="english-div line-clampable" style="-webkit-line-clamp: 1;">${section.english}</div></td>`);
    output.push("</tr>");
  }
  output.push("</table></div>");
  return output.join("");
}

var amudSectionMap = {}

var renderNewResults = function(amudim, directionFunction) {
  var amudimIds = [];
  for (var i = 0; i < amudim.length; i++) {
    var amud = amudim[i];
    amudSectionMap[amud.amud] = amud;
    for (var j = 0; j < amud.sections.length; j++) {
      var section = amud.sections[j];
      var sectionLabel = `${amud.amud}.${j+1}`;
      amudSectionMap[sectionLabel] = section;
    }

    $("#results")[directionFunction](createAmudTable(amud));
    amudimIds.push(`#amud-${amud.amud}`);
  }

  var amudimDivs = $(amudimIds.join(","));
  setCommentaryState(amudimDivs);
  setCommentaryButtons(amudimDivs);
  setEnglishClickListeners(amudimDivs);

  var rows = amudimDivs.find("tr");
  for (var j = 0; j < rows.length; j++) {
    var row = $(rows[j])[0];
    var hebrewHeight = $(row).find(".gemara").height();
    $(row).find(".english-div").attr("hebrewHeight", hebrewHeight);
  }

  var englishTexts = amudimDivs.find(".english-div");
  var englishLineHeight = $(englishTexts[0]).height();

  for (var j = 0; j < englishTexts.length; j++) {
    var item = $(englishTexts[j]);
    var maxLines = Math.floor(parseFloat(item.attr("hebrewHeight")) / englishLineHeight);
    item.css("-webkit-line-clamp", maxLines.toString());
  }
};

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
      && amudSectionMap[gemaraSection.id].quoted_verses.length > 0) {
    displaySnackbar("", {
      text: "Verses",
      onClick: () => {
        var snackbarText = [];
        var verses = amudSectionMap[gemaraSection.id].quoted_verses;

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
  document.addEventListener("selectionchange", onSelectionChange);

  $.ajax({url: `${location.origin}${location.pathname}/json`,
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
