/* global gtag,  */
import $ from "jquery";
import {snackbars} from "./snackbar.js";
import {TalmudRenderer} from "./rendering.jsx";
import {onceDocumentReady} from "./once_document_ready.ts";
import MASECHTOT from "./masechtot.js";
import {amudMetadata, computePreviousAmud, computeNextAmud} from "./amud.ts";
import {driveClient} from "./google_drive/singleton.js";
import {registerRefSelectionSnackbarListener} from "./ref_selection_snackbar.js";

// TODO: reactify?

const masechetNameAndRange = () => {
  const metadata = amudMetadata();
  return metadata.amudStart === metadata.amudEnd
      ? `${metadata.masechet} ${metadata.amudStart}`
      : `${metadata.masechet} ${metadata.amudStart} - ${metadata.amudEnd}`;
};

const renderer = new TalmudRenderer(
  localStorage.translationOption || "english-side-by-side",
  localStorage.wrapTranslations !== "false",
  localStorage.expandEnglishByDefault === "true",
  {
    previous: () => computePreviousAmud(amudMetadata().amudStart),
    next: () => computeNextAmud(amudMetadata().amudEnd),

    hasPrevious: () => {
      const metadata = amudMetadata();
      const bounds = MASECHTOT[metadata.masechet];
      return metadata.amudStart !== bounds.start;
    },
    hasNext: () => {
      const metadata = amudMetadata();
      const bounds = MASECHTOT[metadata.masechet];
      return metadata.amudEnd !== bounds.end;
    },
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    loadPrevious: () => addPreviousAmud(),
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    loadNext: () => addNextAmud(),

    defaultEditText: () => masechetNameAndRange(),
  },
);
renderer.driveClient = driveClient;

const refreshPageState = () => {
  document.title = masechetNameAndRange();
};

const requestAmud = (amud, options) => {
  options = options || {};
  const metadata = amudMetadata();
  renderer.setAmud({
    id: amud,
    title: `${metadata.masechet} ${amud}`,
    loading: true,
  });
  $.ajax({
    url: `${window.location.origin}/api/${metadata.masechet}/${amud}`,
    type: "GET",
    success: (results) => {
      renderer.setAmud(results);
      refreshPageState();
      if (options.callback) options.callback();
      gtag("event", "amud_loaded", {amud});
    },
    error: () => {
      options.backoff = options.backoff || 200;
      options.backoff *= 1.5;
      setTimeout(() => requestAmud(amud, options), options.backoff);
    },
  });
  if (options.newUrl) window.history.replaceState({}, "", options.newUrl);
  refreshPageState();
};

const setWindowTop = (selector) => {
  $("html, body").animate({scrollTop: $(selector).offset().top}, 0);
};

const addNextAmud = () => {
  const metadata = amudMetadata();
  const nextAmud = computeNextAmud(metadata.amudEnd);
  requestAmud(nextAmud, {
    newUrl: `${window.location.origin}/${metadata.masechet}/${metadata.amudStart}/to/${nextAmud}`,
  });

  gtag("event", "load_amud", {
    direction: "next",
    amud: nextAmud,
  });
};

const addPreviousAmud = () => {
  const metadata = amudMetadata();
  const previousAmud = computePreviousAmud(metadata.amudStart);
  requestAmud(previousAmud, {
    newUrl: `${window.location.origin}/${metadata.masechet}/${previousAmud}/to/${metadata.amudEnd}`,
    callback: () => setTimeout(() => setWindowTop("#amud-" + metadata.amudStart), 10),
  });

  gtag("event", "load_amud", {
    direction: "previous",
    amud: previousAmud,
  });
};

const firstFullyOnScreenSection = () => {
  // TODO: is this still necessary? Is React providing this?
  const sections = (
    []
      .concat($("#previous-amud-container"))
      .concat($(".amudContainer"))
      .concat($(".gemara-container")));
  for (const section of sections) {
    const viewTop = $(section).offset().top;
    const {pageTop, height: pageHeight} = window.visualViewport;
    if (viewTop >= pageTop && viewTop <= pageTop + pageHeight) {
      return section;
    }
  }
  return undefined;
};

const maybeSetInitialScrollPosition = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const refLink = urlParams.get("ref_link");
  if (refLink) {
    const urlRefLink = refLink.replace(/:/g, ".");
    const linkedSection = $(`[sefaria-ref="${urlRefLink}"]`);
    setTimeout(() => {
      setWindowTop(linkedSection);
      urlParams.delete("ref_link");
      const {origin, pathname} = window.location;
      const paramsString = urlParams.keys().next().value ? `?${urlParams}` : "";
      window.history.replaceState({}, "", `${origin}${pathname}${paramsString}`);
    }, 10);
    return;
  }

  let scrollToSection = window.location.hash;
  if (scrollToSection.length === 0
      && localStorage.restoreSectionOnRefresh
      && localStorage.restoreSectionOnRefresh.length > 0) {
    const savedSection = "#" + localStorage.restoreSectionOnRefresh;
    if ($(savedSection).length) {
      scrollToSection = savedSection;
    }
  }

  if (scrollToSection.length > 0) {
    setTimeout(() => setWindowTop(scrollToSection), 10);
  }
};

const main = () => {
  const metadata = amudMetadata();
  gtag("set", {masechet: metadata.masechet});

  const amudRange = metadata.range();

  renderer.register("results");

  const requestOptions = {
    counter: 0,
    pageCount: amudRange.length,
    callback: () => {
      requestOptions.counter++;
      if (requestOptions.counter === requestOptions.pageCount) {
        renderer.declareReady();
        $("#initial-load-spinner").hide();

        maybeSetInitialScrollPosition();

        setInterval(() => {
          const section = firstFullyOnScreenSection();
          if (section) {
            localStorage.setItem("restoreSectionOnRefresh", section.id);
          }
        }, 1000);

        onceDocumentReady.declareReady();
      }
    },
  };
  for (const amud of amudRange) {
    requestAmud(amud, requestOptions);
  }

  $("#previous-amud-container").click(addPreviousAmud);
  $("#next-amud-container").click(addNextAmud);
};


$(document).ready(main);

onceDocumentReady.execute(registerRefSelectionSnackbarListener);

onceDocumentReady.execute(() => {
  const modalContainer = $("#modal-container");
  modalContainer.click((event) => {
    if (event.target === modalContainer[0]) {
      modalContainer.hide();
    }
  });
});

driveClient.signInStatusListener = () => {
  if (driveClient.isSignedIn) {
    return;
  }

  snackbars.googleSignIn.show("Save notes to Google Drive?", [
    {
      text: "No thanks",
      onClick: () => snackbars.googleSignIn.dismissButtonImpl(),
    },
    {
      text: "Sign in",
      onClick: () => {
        snackbars.googleSignIn.hide();
        driveClient.signIn();
      },
    },
  ]);
};

driveClient.databaseUpdatedListener = () => renderer.forceUpdate();

driveClient.onErrorListener = () => {
  if (Object.keys(driveClient.errors).length) {
    snackbars.errors.show(Object.values(driveClient.errors).join("<br><br>"));
  } else {
    snackbars.errors.hide();
  }
};
