var requestAmud = function(amud, directionFunction, options) {
  options = options || {}
  var divId = `amud-${amud}`;
  $("#results")[directionFunction](`<div id="${divId}" class="amudContainer">`);
  var metadata = amudMetadata();
  var renderer = new TalmudRenderer(localStorage.translationOption || "both");
  renderer.renderContainer({
    title: `${metadata.masechet} ${amud}`,
    loading: true
  }, divId)
  $.ajax({url: `${location.origin}/api/${metadata.masechet}/${amud}`,
          type: "GET",
          success: function(results) {
            renderer.renderContainer(results, divId);
            refreshPageState();
            if (options.callback) options.callback();
            gtag("event", "amud_loaded", {
              amud: amud,
            });
          },
          error: function() {
            options.backoff = options.backoff || 200;
            options.backoff *= 1.5;
            setTimeout(() => requestAmud(amud, directionFunction, options), options.backoff);
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
    const bounds = MASECHTOT[metadata.masechet];
    setVisibility($("#previous-amud-container"), metadata.amudStart !== bounds.start);
    setVisibility($("#next-amud-container"), metadata.amudEnd !== bounds.end);

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

  var requestOptions = {
    counter: 0,
    pageCount: amudRange.length,
    callback: function() {
      this.counter++;
      if (this.counter === this.pageCount) {
        $results.show();
        $("#initial-load-spinner").hide();

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
        $("#previous-amud-container"),
        $(".amudContainer"),
        $(".gemara"));
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
