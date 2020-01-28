var COMMENTARIES = [
  // "verses",
  {englishName: "Rashi", className: "rashi"},
  {englishName: "Tosafot", className: "tosafot"},
  {englishName: "Ramban", className: "ramban"},
  {englishName: "Rashba", className: "rashba"},
  {englishName: "Ritva", className: "ritva"},
  {englishNamePrefix: "Shulchan Arukh, ", className: "shulchan-arukh"},
  {englishNamePrefix: "Mishneh Torah, ", className: "mishneh-torah"},
  {englishName: "Sefer Mitzvot Gadol", className: "smag", hebrewNameOverride: "סמ\"ג"}
];

var matchingCommentaryKind = function(name) {
  for (var i in COMMENTARIES) {
    var kind = COMMENTARIES[i];
    if (name === kind.englishName || name.startsWith(kind.englishNamePrefix)) {
      return kind;
    }
  }
}

var commentarySection = function(commentary) {
  var lines = [];
  var name;
  for (var i = 0; i < commentary.length; i++) {
    lines.push(commentary[i]["he"]);
    name = commentary[i]["collectiveTitle"];
  }
  console.log("foo");
  var commentaryKind = matchingCommentaryKind(name.en);
  if (!commentaryKind) {
    return "";
  }
  return [
    `<a class="commentary_header ${commentaryKind.className}-header">${name.he}</a>`,
    `<div class="${commentaryKind.className}">`,
    lines.join("<br>"),
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
      var commentary = COMMENTARIES[j].className;
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
      var className = COMMENTARIES[j].className;
      $(section.find(`.${className}-header`)).click(commentaryClickListener(section, `.${className}`, amudim));
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

var referencedVersesAsLines = function(section) {
  return section.quotedVerses.map(verse => `${verse.hebrew} <small>(${verse.label.hebrew})</small>`);
}

var createAmudTable = function(amud) {
  var output = [
    `<div id="amud-${amud.id}">`,
    "<table>",
    `<h2>${amud.title}</h2>`];
  console.log(amud);
  for (var i = 0; i < amud.he.length; i++) {
    var hebrew = [];
    var sectionLabel = `${amud.id}.${i+1}`;
    hebrew.push(`<div class="gemara" id="${sectionLabel}">${amud.he[i]}</div>`);
    hebrew.push('<div class="commentary">');
    // TODO: hebrew.push(commentarySection(referencedVersesAsLines(section), "verses"));
    var commentaries = amud.commentaryIndex[`${amud.book} ${amud.id}:${i+1}`];
    if (commentaries) {
      for (var j in commentaries) {
        var commentary = commentaries[j];
        hebrew.push(commentarySection(commentary));
      }
    }
    hebrew.push("</div>"); // .commentary

    output.push("<tr>");
    output.push(`<td dir="rtl" class="hebrew">${hebrew.join("")}</td>`);
    output.push(`<td dir="ltr" class="english"><div class="english-div line-clampable" style="-webkit-line-clamp: 1;">${amud.text[i]}</div></td>`);
    output.push("</tr>");
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
    var commentaryName = commentary["collectiveTitle"]["en"];
    if (!sectionCommentary[commentaryName]) {
      sectionCommentary[commentaryName] = [];
    }
    sectionCommentary[commentaryName].push(commentary);
  }
  
  amudSectionMap[amud.id] = amud;
  console.log(amud);
  
  $("#results")[directionFunction](createAmudTable(amud));
  amudimIds.push(`#amud-${amud.id}`);

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
