var LAST_AMUD_PER_MASECHET = {
  "Arakhin": "34a",
  "Avodah Zarah": "76b",
  "Bava Batra": "176b",
  "Bava Kamma": "119b",
  "Bava Metzia": "119a",
  "Beitzah": "40b",
  "Bekhorot": "61a",
  "Berakhot": "64a",
  "Chagigah": "27a",
  "Chullin": "142a",
  "Eruvin": "105a",
  "Gittin": "90b",
  "Horayot": "14a",
  "Keritot": "28b",
  "Ketubot": "112b",
  "Kiddushin": "82b",
  "Makkot": "24b",
  "Megillah": "32a",
  "Meilah": "22a",
  "Menachot": "110a",
  "Moed Katan": "29a",
  "Nazir": "66b",
  "Nedarim": "91b",
  "Niddah": "73a",
  "Pesachim": "121b",
  "Rosh Hashanah": "35a",
  "Sanhedrin": "113b",
  "Shabbat": "157b",
  "Shevuot": "49b",
  "Sotah": "49b",
  "Sukkah": "56b",
  "Taanit": "31a",
  "Tamid": "33b",
  "Temurah": "34a",
  "Yevamot": "122b",
  "Yoma": "88a",
  "Zevachim": "120b",
}

var requestAmud = function(amud, directionFunction, options) {
  options = options || {}
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
            new TalmudRenderer(localStorage.translationOption || "both")
              .renderContainer(results, divId);
            refreshPageState();
            spinner.hide();
            if (options.callback) options.callback();
            gtag("event", "amud_loaded", {
              amud: amud,
            });
          },
          error: function() {
            options.retryCount = options.retryCount || 0;
            options.retryCount++;
            setTimeout(() => requestAmud(amud, directionFunction, options), options.retryCount);
          }});
  if (options.newUrl) history.pushState({}, "", options.newUrl);
  refreshPageState();
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
    setVisibility($("#next-amud-container"), metadata.amudEnd !== LAST_AMUD_PER_MASECHET[metadata.masechet]);

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
  var metadata = amudMetadata();
  gtag("set", {
    "masechet": metadata.masechet,
  });

  var amudRange = metadata.range();
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
  var nextAmud = computeNextAmud(metadata.amudEnd);
  requestAmud(nextAmud, "append", {
    newUrl: `${location.origin}/${metadata.masechet}/${metadata.amudStart}/to/${nextAmud}`
  });

  gtag("event", "load_amud", {
    direction: "next",
    amud: nextAmud,
  });
}

var addPreviousAmud = function() {
  var metadata = amudMetadata();
  var previousAmud = computePreviousAmud(metadata.amudStart);
  requestAmud(previousAmud, "prepend", {
    newUrl: `${location.origin}/${metadata.masechet}/${previousAmud}/to/${metadata.amudEnd}`,
    callback: () => setTimeout(() => setWindowTop("#amud-" + metadata.amudStart), 10)
  });

  gtag("event", "load_amud", {
    direction: "previous",
    amud: previousAmud,
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
