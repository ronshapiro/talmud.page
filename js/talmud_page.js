import {displaySnackbar, hideSnackbar} from "./snackbar.js";
import {TalmudRenderer, _concat, setVisibility, onceDocumentReady} from "./rendering.js";
import MASECHTOT from "./masechtot.js";

const requestAmud = function(amud, directionFunction, options) {
  options = options || {}
  const divId = `amud-${amud}`;
  $("#results")[directionFunction](`<div id="${divId}" class="amudContainer">`);
  const metadata = amudMetadata();
  const renderer = new TalmudRenderer(localStorage.translationOption || "both");
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

const computePreviousAmud = function(current) {
  const number = parseInt(current);
  return current.endsWith("b") ? number + "a" : (number - 1) + "b";
}

const computeNextAmud = function(current) {
  const number = parseInt(current);
  return current.endsWith("a") ? number + "b" : (number + 1) + "a";
}

const amudMetadata = function() {
  const pathParts = location.pathname.split("/");
  return {
    // TODO: Add tests for this for two-word amudim
    masechet: pathParts[1].replace("_", " "),
    amudStart: pathParts[2],
    amudEnd: pathParts[4] || pathParts[2],
    range: function() {
      let current = this.amudStart;
      const results = [current];
      while (current !== this.amudEnd) {
        current = computeNextAmud(current);
        results.push(current);
      }
      return results;
    }
  }
}

const refreshPageState = function() {
  setHtmlTitle();

  onceDocumentReady.execute(function() {
    const metadata = amudMetadata();
    // Note that these may still be hidden by their container if the full page hasn't loaded yet.
    const bounds = MASECHTOT[metadata.masechet];
    setVisibility($("#previous-amud-container"), metadata.amudStart !== bounds.start);
    setVisibility($("#next-amud-container"), metadata.amudEnd !== bounds.end);

    $("#previous-amud-button").text(`Load ${computePreviousAmud(metadata.amudStart)}`);
    $("#next-amud-button").text(`Load ${computeNextAmud(metadata.amudEnd)}`);
  });
}

const setHtmlTitle = function() {
  const metadata = amudMetadata();
  document.title =
    metadata.amudStart === metadata.amudEnd
    ? `${metadata.masechet} ${metadata.amudStart}`
    : `${metadata.masechet} ${metadata.amudStart} - ${metadata.amudEnd}`;
}

const main = function() {
  const metadata = amudMetadata();
  gtag("set", {
    "masechet": metadata.masechet,
  });

  const amudRange = metadata.range();
  const $results = $("#results");
  $results.hide();

  const requestOptions = {
    counter: 0,
    pageCount: amudRange.length,
    callback: function() {
      this.counter++;
      if (this.counter === this.pageCount) {
        $results.show();
        $("#initial-load-spinner").hide();

        let scrollToSection = location.hash;
        if (scrollToSection.length === 0) {
          const savedSection = "#" + localStorage.restoreSectionOnRefresh;
          if ($(savedSection).length) {
            scrollToSection = savedSection;
          }
        }
        if (scrollToSection.length > 0) {
          setTimeout(() => setWindowTop(scrollToSection), 10);
        }

        setInterval(function() {
          const section = firstFullyOnScreenSection();
          if (section) {
            localStorage.setItem("restoreSectionOnRefresh", section.id);
          }
        }, 1000);

        onceDocumentReady.declareReady();
      }
    }
  }
  for (const amud of amudRange) {
    requestAmud(amud, "append", requestOptions);
  }

  $("#previous-amud-container").click(addPreviousAmud);
  $("#next-amud-container").click(addNextAmud);
}

const addNextAmud = function() {
  const metadata = amudMetadata();
  const nextAmud = computeNextAmud(metadata.amudEnd);
  requestAmud(nextAmud, "append", {
    newUrl: `${location.origin}/${metadata.masechet}/${metadata.amudStart}/to/${nextAmud}`
  });

  gtag("event", "load_amud", {
    direction: "next",
    amud: nextAmud,
  });
}

const addPreviousAmud = function() {
  const metadata = amudMetadata();
  const previousAmud = computePreviousAmud(metadata.amudStart);
  requestAmud(previousAmud, "prepend", {
    newUrl: `${location.origin}/${metadata.masechet}/${previousAmud}/to/${metadata.amudEnd}`,
    callback: () => setTimeout(() => setWindowTop("#amud-" + metadata.amudStart), 10)
  });

  gtag("event", "load_amud", {
    direction: "previous",
    amud: previousAmud,
  });
}

const setWindowTop = function(selector) {
  $("html, body").animate({scrollTop: $(selector).offset().top}, 0);
}

const firstFullyOnScreenSection = function() {
  const sections =
      _concat(
        $("#previous-amud-container"),
        $(".amudContainer"),
        $(".gemara"));
  for (const section of sections) {
    const viewTop = $(section).offset().top;
    const pageTop = window.visualViewport.pageTop;
    const pageHeight = window.visualViewport.height;
    if (viewTop >= pageTop && viewTop <= pageTop + pageHeight) {
      return section;
    }
  }
}

let selectionChangeSnackbarShowing = false;
const hideSelectionChangeSnackbar = (ref) => {
  if (selectionChangeSnackbarShowing) {
    gtag("event", "selection_change_snackbar.hidden", {ref: ref});
    selectionChangeSnackbarShowing = false;
    hideSnackbar();
  }
};

const findSefariaRef = function(node) {
  let isEnglish = false;
  while (node.parentElement) {
    const $parentElement = $(node.parentElement);
    isEnglish = isEnglish || $parentElement.hasClass("english");
    const isTranslationOfSourceText = $parentElement.attr("commentary-kind") === "Translation";
    const ref = $parentElement.attr("sefaria-ref");
    if (ref && ref !== "synthetic") {
      if (isEnglish && isTranslationOfSourceText) {
        // Go up one layer to the main text
        isEnglish = false;
      } else {
        return {
          ref: ref,
          text: $($parentElement.find(".hebrew")[0]).text(),
          translation: isTranslationOfSourceText
            ? undefined
            : $($parentElement.find(".english")[0]).text(),
        };
      }
    }
    node = node.parentNode;
  }
  return {};
}

document.addEventListener('selectionchange', () => {
  const selection = document.getSelection();
  if (selection.type !== "Range") {
    hideSelectionChangeSnackbar();
    return;
  }
  const sefariaRef = findSefariaRef(selection.anchorNode);
  if (!sefariaRef.ref
      // If the selection spans multiple refs, ignore them all
      || sefariaRef.ref !== findSefariaRef(selection.focusNode).ref) {
    hideSelectionChangeSnackbar(sefariaRef.ref);
    return;
  }
  const ref = sefariaRef.ref;
  const sefariaUrl = `https://www.sefaria.org/${ref.replace(/ /g, "_")}`;
  gtag("event", "selection_change_snackbar.shown", {ref: ref});
  selectionChangeSnackbarShowing = true;
  displaySnackbar(ref, [
    {
      text: "View on Sefaria",
      onClick: () => {
        window.location = sefariaUrl;
        gtag("event", "view_on_sefaria", {ref: ref});
      },
    },
    {
      text: "Report correction",
      onClick: () => {
        gtag("event", "report_correction", {ref: ref});
        const subject = "Sefaria Text Correction from talmud.page";
        let body = [
          `${ref} (${sefariaUrl})`,
          sefariaRef.text,
        ];
        if (sefariaRef.translation && sefariaRef.translation !== "") {
          body.push(sefariaRef.translation);
        }
        // trailing newline so that the description starts on its own line
        body.push("Describe the error:\n");

        body = body.join("\n\n");
        // TODO: verify the iOS versions. Also verify what non-Gmail clients do
        if (/(Android|iPhone|iPad|iOS)/.test(navigator.userAgent)) {
          body = body.replace(/\n/g, "<br>");
        }
        body = encodeURIComponent(body);
        window.open(`mailto:corrections@sefaria.org?subject=${subject}&body=${body}`);
      },
    },
  ]);
});

$(document).ready(main);
