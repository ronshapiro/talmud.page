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
  var hideUrl = `${location.origin}/hide_result/${thisHash}/${result.result_id}`
  return function() {
    $.ajax({url: hideUrl, type: "GET"})
    $(resultDivId(result)).fadeOut();
    result.visible = false;
    updateResultsCount();
  }
}

$(function() {
  initResultsHtml();
  updateResultsCount();
  
  storeSearchHistory();
});
