var thisHash = document.location.pathname.substring("/search/".length);

var storeSearchHistory = function() {
  var searches = localStorage.searches === undefined ? [] : JSON.parse(localStorage.searches);
  searches = searches.filter(x => x !== thisHash);
  searches = [thisHash].concat(searches);
  localStorage.searches = JSON.stringify(searches);
}

var initResultsHtml = function() {
  var results_html = []
  for (var x in results) {
    var result = results[x];
    if (!result.visible) continue;
    results_html.push([
      `<div id="ui-result-${result.result_id}" class="ui-result">`,
      `  <img class="ui-result-delete" src="/static/delete.svg" />`,
      '  <div class="ui-result-main">',
      `    <h2><a href="${result.link}">${result.title}</a></h2>`,
      `    <p dir=rtl>${result.hebrew}</p>`,
      `    <p>${result.english}</p>`,
      "    </br>",
      "  </div>",
      "</div>"
    ].join("\n"));
  }
  $("#results").html(results_html.join("\n"));

  for (var x in results) {
    var result = results[x];
    if (!result.visible) continue;
    $(`${resultDivId(result)} .ui-result-delete`).click(hideClickListener(result));
  }
  for (var x in results) {
    var result = results[x];
    if (!result.visible) continue;
    $(`${resultDivId(result)} .ui-result-delete`).click(hideClickListener(result));
  }
}

var setFrozenState = function() {
  $("#freeze-button").text(frozen ? "Frozen" : "Freeze");
  if (frozen) {
    $('.ui-result-delete').css("opacity", 0);
    $("#freeze-button").removeClass("mdl-button--accent");
    var hideRipple = setInterval(function() {
      var rippleView = $("#freeze-button .mdl-button__ripple-container");
      if (rippleView.length > 0) {
        clearInterval(hideRipple);
        rippleView.remove();
      }
    }, 100);
  } else {
    $("#freeze-button").click(function() {
      if (frozen) return;
      $.ajax({url: `${location.origin}/search/freeze/${thisHash}`, type: "GET"});
      frozen = true;
      setFrozenState();
      console.log("frozen");
    });
  }
}

var setCopyButtonListener = function() {
  $("#copy-button").click(function() {
    location = `${location.origin}/search/copy/${thisHash}`;
  });
}


var updateResultsCount = function() {
  var count = 0;
  for (x in results) {
    if (results[x].visible) count++;
  }
  $("#results_count").text(`(${count})`);
}

var resultDivId = function(result) {
  return `#ui-result-${result.result_id}`;
}

var hideClickListener = function(result) {
  var hideUrl = `${location.origin}/hide_result/${thisHash}/${result.result_id}`;
  return function() {
    $.ajax({url: hideUrl, type: "GET"});
    $(resultDivId(result)).fadeOut();
    result.visible = false;
    updateResultsCount();
  }
}

$(function() {
  initResultsHtml();
  setFrozenState();
  setCopyButtonListener();
  updateResultsCount();
  
  storeSearchHistory();
});
