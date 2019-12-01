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
    var starState = result.starred ? "full" : "empty";
    results_html.push([
      `<div id="ui-result-${result.result_id}" class="ui-result">`,
      '  <img class="action-button delete" src="/static/delete.svg" />',
      '  <img class="action-button star star-preload"/>',
      // If adding another action-button, make sure to update setFrozenState
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
    $(`${result.divId} .delete`).click(hideClickListener(result));
    $(`${result.divId} .star`).click(starClickListener(result));
    setStarImageState(result);
    if (!result.visible) {
      $(result.divId).addClass("demoted");
    }
  }
}

var setFrozenState = function() {
  $("#freeze-button").text(frozen ? "Frozen" : "Freeze");
  if (frozen) {
    $('.ui-result .delete').remove();
    $('.ui-result .star-empty').remove();
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

var setResultExtensions = function() {
  for (x in results) {
    var result = results[x]
    result.divId = `#ui-result-${result.result_id}`
    result.actionUrl = function(result) {
      return action => `${location.origin}/${thisHash}/${result.result_id}/${action}`;
    }(result);
  }
}

var hideClickListener = function(result) {
  return function() {
    $.ajax({url: result.actionUrl("hide"), type: "GET"});
    $(result.divId).fadeOut(undefined, function() {
      $(result.divId).show().addClass("demoted");

      result.visible = false;
      sortResults();
      updateResultsCount();

      var previousIndex = results.indexOf(result) - 1;
      if (previousIndex >= 0)  {
        $(result.divId).detach().insertAfter(results[previousIndex].divId);
      }
    });
  }
}

var starClickListener = function(result) {
  return function() {
    if (frozen) return;
    var action = result.starred ? "unstar" : "star";
    $.ajax({url: result.actionUrl(action), type: "GET"});
    result.starred = !result.starred;
    setStarImageState(result);
  }
}

var setStarImageState = function(result) {
  var starState = result.starred ? "full" : "empty";
  $(`${result.divId} .star`)
      .attr("src", `/static/star-${starState}.svg`)
      .removeClass("star-preload star-full star-empty")
      .addClass(`star-${starState}`);
}

var resultComparator = function(first, second) {
  if (first.visible && !second.visible) {
    return -1;
  } else if (second.visible && !first.visible) {
    return 1;
  }

  if (first.starred && !second.starred) {
    return -1;
  } else if (second.starred && !first.starred) {
    return 1;
  }
  return first.result_id - second.result_id;
}

var sortResults = function() {
  results.sort(resultComparator);
}

$(function() {
  setResultExtensions();
  sortResults();

  initResultsHtml();
  setFrozenState();
  setCopyButtonListener();
  updateResultsCount();

  storeSearchHistory();

  $(".search-match").addClass("mdl-color-text--accent")
});
