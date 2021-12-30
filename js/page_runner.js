/* global gtag,  */
import {ApiCache} from "./ApiCache.ts";
import {mainCache} from "./caches.ts";
import {$} from "./jquery";
import {snackbars} from "./snackbar.ts";
import {onceDocumentReady} from "./once_document_ready.ts";
import {amudMetadata} from "./amud.ts";
import {enableBackButtonProtection} from "./block_back_button.ts";
import {timeoutPromise} from "./promises";
import {registerRefSelectionSnackbarListener} from "./ref_selection_snackbar.ts";

const bookTitleAndRange = () => {
  const metadata = amudMetadata();
  return metadata.amudStart === metadata.amudEnd
    ? `${metadata.masechet} ${metadata.amudStart}`
    : `${metadata.masechet} ${metadata.amudStart} - ${metadata.amudEnd}`;
};

const refreshPageState = () => {
  document.title = bookTitleAndRange();
};

const setWindowTop = (selector) => {
  $("html, body").animate({scrollTop: $(selector).offset().top}, 0);
};

const maybeSetInitialScrollPosition = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const refLink = urlParams.get("ref_link");
  if (refLink) {
    const linkedSection = $(`[sefaria-ref="${refLink}"]`);
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
    if ($(savedSection).length > 0) {
      scrollToSection = savedSection;
    }
  }

  if (scrollToSection.length > 0) {
    setTimeout(() => setWindowTop(scrollToSection), 10);
  }
};

const firstFullyOnScreenSection = () => {
  // TODO: is this still necessary? Is React providing this?
  const sections = [].concat($(".amudContainer")).concat($(".gemara-container"));
  for (const section of sections) {
    const viewTop = $(section).offset().top;
    const {pageTop, height: pageHeight} = window.visualViewport;
    if (viewTop >= pageTop && viewTop <= pageTop + pageHeight) {
      return section;
    }
  }
  return undefined;
};

export class Runner {
  constructor(renderer, driveClient, resourceType) {
    this.renderer = renderer;
    this.driveClient = driveClient;
    this.resourceType = resourceType;
    renderer.driveClient = driveClient;
    Object.assign(
      renderer.navigationExtension,
      {
        loadPrevious: () => this.addPreviousSection(),
        loadNext: () => this.addNextSection(),
        defaultEditText: () => bookTitleAndRange(),
      });
    this.apiCache = new ApiCache();
    timeoutPromise(5000).then(() => this.apiCache.purge());
  }

  requestSection(section, options) {
    options = options || {};
    this.renderer.setAmud({
      id: section,
      title: this.renderer.newPageTitle(section),
      loading: true,
      sections: [],
    });
    const endpoint = `api/${amudMetadata().masechet}/${section}`;
    this.apiCache.getAndUpdate(endpoint).then((results) => {
      options.finished = true;
      this.renderer.setAmud(results);
      refreshPageState();
      if (options.callback) options.callback();
      gtag("event", "section_loaded", {section});
    });
    if (options.newUrl) {
      const oldUrl = window.location.href;
      const {newUrl} = options;
      mainCache().then(cache => {
        cache.match(oldUrl).then(cachedResponse => {
          cache.put(newUrl, cachedResponse.clone());
        });
      });
      window.history.replaceState({}, "", newUrl);
    }
    refreshPageState();
  }

  newUrlRange(start, end) {
    return `${window.location.origin}/${amudMetadata().masechet}/${start}/to/${end}`;
  }

  addNextSection() {
    const metadata = amudMetadata();
    const nextSection = this.renderer.navigationExtension.next();
    this.requestSection(nextSection, {
      newUrl: this.newUrlRange(metadata.amudStart, nextSection),
    });

    gtag("event", "load_section", {
      direction: "next",
      section: nextSection,
    });
  }

  addPreviousSection() {
    const metadata = amudMetadata();
    const previousSection = this.renderer.navigationExtension.previous();
    this.requestSection(previousSection, {
      newUrl: this.newUrlRange(previousSection, metadata.amudEnd),
      callback: () => setTimeout(() => setWindowTop("#amud-" + metadata.amudStart), 10),
    });

    gtag("event", "load_section", {
      direction: "previous",
      section: previousSection,
    });
  }

  main() {
    $(document).ready(() => {
      const metadata = amudMetadata();
      gtag("set", {section: metadata.masechet});

      const amudRange = metadata.range();

      this.renderer.register("results");

      const requestOptions = {
        counter: 0,
        pageCount: amudRange.length,
        callback: () => {
          requestOptions.counter++;
          if (requestOptions.counter === requestOptions.pageCount) {
            this.renderer.declareReady();
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
        this.requestSection(amud, requestOptions);
      }
    });

    onceDocumentReady.execute(registerRefSelectionSnackbarListener);

    onceDocumentReady.execute(() => {
      const modalContainer = $("#modal-container");
      modalContainer.click((event) => {
        if (event.target === modalContainer[0]) {
          modalContainer.hide();
        }
      });
    });

    this.driveClient.signInStatusListener = () => {
      if (this.driveClient.isSignedIn) {
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
            this.driveClient.signIn();
          },
        },
      ]);
    };

    this.driveClient.databaseUpdatedListener = () => this.renderer.forceUpdate();

    this.driveClient.onErrorListener = () => {
      if (Object.keys(this.driveClient.errors).length > 0) {
        snackbars.errors.show(Object.values(this.driveClient.errors).join("<br><br>"));
      } else {
        snackbars.errors.hide();
      }
    };

    if (window.location.hostname === "localhost") {
      window.dumpDocument = () => {
        $.ajax({
          type: "POST",
          url: `${window.location.origin}/google-docs-record`,
          data: JSON.stringify(this.driveClient.databaseDocument),
          dataType: "json",
          contentType: "application/json",
        });
      };
    }
  }
}

enableBackButtonProtection();
