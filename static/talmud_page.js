var commentarySection = function(lines, header, cssClass) {
  if (!lines.length) {
    return "";
  }
  return [
    `<a class="commentary_header ${cssClass}-header">${header}</a>`,
    `<div class="${cssClass}">`,
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

var setCommentaryState = function() {
  var commentarySections = $(".commentary");
  for (var i = 0; i < commentarySections.length; i++) {
    var section = $(commentarySections[i]);
    var rashi = $(section.find(".rashi")[0]);
    var tosafot = $(section.find(".tosafot")[0]);
    var rashiEnabled = rashi.attr("commentary-enabled") !== undefined;
    var tosafotEnabled = tosafot.attr("commentary-enabled") !== undefined;
    section.css("display", rashiEnabled || tosafotEnabled ? "block" : "flex");
    setVisibility(rashi, rashiEnabled);
    setVisibility(tosafot, tosafotEnabled);
  }
};

var setCommentaryButtons = function() {
  var commentarySections = $(".commentary");
  for (var i = 0; i < commentarySections.length; i++) {
    var section = $(commentarySections[i]);
    $(section.find(".rashi-header")).click(commentaryClickListener(section, ".rashi"));
    $(section.find(".tosafot-header")).click(commentaryClickListener(section, ".tosafot"));
  }
};

var commentaryClickListener = function(section, targetViewSelector) {
  return function() {
    var targetView = $(section.find(targetViewSelector)[0]);
    if (targetView.attr("commentary-enabled")) {
      targetView.removeAttr("commentary-enabled");
    } else {
      targetView.attr("commentary-enabled", "true");
    }
    setCommentaryState();
  }
}

var setEnglishClickListeners = function() {
  var sections = $(".english-div");
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
  var output = ["<table>"];
  for (var i in amud) {
    var hebrew = [];
    var section = amud[i];
    hebrew.push(`<div class="gemara">${section.gemara}</div>`);
    hebrew.push('<div class="commentary">');
    hebrew.push(commentarySection(section.rashi, "רש״י", "rashi"));
    hebrew.push(commentarySection(section.tosafot, "תוספות", "tosafot"));
    hebrew.push("</div>"); // .commentary

    output.push("<tr>");
    output.push(`<td dir="rtl" class="hebrew">${hebrew.join("")}</td>`);
    output.push(`<td dir="ltr" class="english"><div class="english-div line-clampable" style="-webkit-line-clamp: 1;">${section.english}</div></td>`);
    output.push("</tr>");
  }
  output.push("</table>");
  return output.join("");
}

var renderResults = function(amud) {
  $("#results").html(createAmudTable(amud));
  setCommentaryState();
  setCommentaryButtons();
  setEnglishClickListeners();

  var rows = $("tr");
  for (var j = 0; j < rows.length; j++) {
    var row = $(rows[j])[0];
    var hebrewHeight = $(row).find(".gemara").height();
    $(row).find(".english-div").attr("hebrewHeight", hebrewHeight);
  }
  var englishLineHeight = $($(".english-div")[0]).height();

  var englishTexts = $(".english-div");
  for (var j = 0; j < englishTexts.length; j++) {
    var item = $(englishTexts[j]);
    var maxLines = Math.floor(parseFloat(item.attr("hebrewHeight")) / englishLineHeight);
    item.css("-webkit-line-clamp", maxLines.toString());
  }
};

var main = function() {
  $.ajax({url: location.href + "/json", type: "GET", success: renderResults});

  var pathParts = location.pathname.split("/");
  var masechet = pathParts[1];
  var amud = pathParts[2];
  var amud2 = pathParts[4];
  var title = masechet + " " + amud;
  if (amud2) {
    title += "-" + amud2;
  }
  document.title = title;
  $("#title").html(title).show();
}

// history.pushState(state, pageTitle, url);

$(document).ready(main);
