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
    var starState = result.starred ? "full" : "empty";
    results_html.push([
      `<div id="ui-result-${result.result_id}" class="ui-result">`,
      '  <img class="action-button delete" src="/static/delete.svg" />',
      `  <img class="action-button star star-preload"/>`,
      '  <div class="ui-result-main">',
      `    <h2><a href="${result.link}">${result.title}</a></h2>`,
      `    <p dir=rtl class="hebrew">${result.hebrew}</p>`,
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
    $(`${resultDivId(result)} .delete`).click(hideClickListener(result));
    $(`${resultDivId(result)} .star`).click(starClickListener(result));
    setStarImageState(result);
  }
}

var setFrozenState = function() {
  $("#freeze-button").text(frozen ? "Frozen" : "Freeze");
  if (frozen) {
    $('.ui-result .action-button').css("opacity", 0);
    $("#freeze-button").attr("disabled", 1);
  } else {
    $("#freeze-button").click(function() {
      if (frozen) return;
      $.ajax({url: `${location.origin}/search/freeze/${thisHash}`, type: "GET"});
      frozen = true;
      setFrozenState();
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
  var hideUrl = `${location.origin}/${thisHash}/${result.result_id}/hide`;
  return function() {
    $.ajax({url: hideUrl, type: "GET"});
    $(resultDivId(result)).fadeOut();
    result.visible = false;
    updateResultsCount();
  }
}

var starClickListener = function(result) {
  return function() {
    var action = result.starred ? "unstar" : "star";
    var url = `${location.origin}/${thisHash}/${result.result_id}/${action}`;
    $.ajax({url: url, type: "GET"});
    result.starred = !result.starred;
    setStarImageState(result);
  }
}

var setStarImageState = function(result) {
  var starState = result.starred ? "full" : "empty";
  var star = $(`${resultDivId(result)} .star`);
  star.attr("src", `/static/star-${starState}.svg`);
  star.removeClass("star-preload");
}

$(function() {
  initResultsHtml();
  setFrozenState();
  setCopyButtonListener();
  updateResultsCount();

  storeSearchHistory();

  $(".search-match").addClass("mdl-color-text--accent")
});
