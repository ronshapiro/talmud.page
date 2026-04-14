/* global gtag,  */
import {once} from "underscore";
import {ApiCache} from "./ApiCache.ts";
import {FontCache} from "./FontCache.ts";
import {mainCache} from "./caches.ts";
import {$} from "./jquery";
import {snackbars} from "./snackbar.ts";
import {onceDocumentReady} from "./once_document_ready.ts";
import {amudMetadata} from "./amud.ts";
import {enableBackButtonProtection} from "./block_back_button.ts";
import {PromiseQueue, timeoutPromise} from "./promises";
import {registerRefSelectionSnackbarListener} from "./ref_selection_snackbar.ts";
import {serviceWorkerMain} from "./service_worker_registration.ts";
import {initializeLocalStorage} from "./initializeLocalStorage";

initializeLocalStorage();

const bookTitleAndRange = () => {
  const metadata = amudMetadata();
  if (metadata.documentTitleOverride) {
    return metadata.documentTitleOverride;
  }
  return metadata.amudStart === metadata.amudEnd
    ? `${metadata.masechet} ${metadata.amudStart}`
    : `${metadata.masechet} ${metadata.amudStart} - ${metadata.amudEnd}`;
};

const refreshPageState = () => {
  document.title = bookTitleAndRange();
};

const setWindowTop = (selector) => {
  try {
    $("html, body").animate({scrollTop: $(selector).offset().top}, 0);
  } catch (e) {
    console.error(e); // eslint-disable-line no-console
  }
};

function extractError(error) {
  if (error.status === 404) return "Server Error";
  return error.responseText || error.statusText;
}

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
    try {
      if ($(savedSection).length > 0) {
        scrollToSection = savedSection;
      }
    } catch (e) {
      console.log("Invalid savedSection", savedSection, e); // eslint-disable-line no-console
    }
  }

  if (scrollToSection.length > 0) {
    setTimeout(() => setWindowTop(scrollToSection), 10);
  }
};

const firstFullyOnScreenSection = () => {
  // TODO: is this still necessary? Is React providing this?
  const sections = [
    ...Array.from($(".amudContainer")),
    ...Array.from($(".gemara-container")),
  ];
  for (const section of sections) {
    if (section.id && section.id.includes("hidden")) continue;
    const viewTop = $(section).offset().top;
    const {pageTop, height: pageHeight} = window.visualViewport;
    if (viewTop >= pageTop && viewTop <= pageTop + pageHeight) {
      return section;
    }
  }
  return undefined;
};

function periodicallySaveScrollPosition() {
  setInterval(() => {
    const section = firstFullyOnScreenSection();
    if (section) {
      localStorage.setItem("restoreSectionOnRefresh", section.id);
    }
    localStorage.lastUrl = window.location.href;
    localStorage.platform = window.navigator.platform;
    localStorage.navigatorVendor = window.navigator.vendor;
    if (window.navigator.userAgentData) {
      localStorage.userAgentPlatform = window.navigator.userAgentData.platform;
      localStorage.userAgentBrands = JSON.stringify(window.navigator.userAgentData.brands);
      localStorage.isMobile = window.navigator.userAgentData.mobile;
    }
  }, 1000);
}

export class Runner {
  constructor(renderer, driveClient) {
    this.renderer = renderer;
    this.driveClient = driveClient;
    renderer.driveClient = driveClient;
    Object.assign(
      renderer.navigationExtension,
      {
        loadPrevious: () => this.addPreviousSection(),
        loadNext: () => this.addNextSection(),
        removeFirst: () => this.removeFirstSection(),
        removeLast: () => this.removeLastSection(),
        defaultEditText: () => bookTitleAndRange(),
      });
    if (!renderer.navigationExtension.displayNext) {
      renderer.navigationExtension.displayNext = renderer.navigationExtension.next;
    }
    if (!renderer.navigationExtension.displayPrevious) {
      renderer.navigationExtension.displayPrevious = renderer.navigationExtension.previous;
    }
    this.apiCache = new ApiCache();
    this.requestQueue = new PromiseQueue(5);
    timeoutPromise(5000).then(() => this.apiCache.purge());
  }

  getAndCacheSection(section, errorCallback) {
    return this.apiCache.getAndUpdate(
      `api/${amudMetadata().masechet}/${section}`, errorCallback);
  }

  requestSection(section, options) {
    options = options || {};
    const pseudoLoadingAmud = {
      id: section,
      title: this.renderer.newPageTitle(section),
      titleHebrew: this.renderer.newPageTitleHebrew(section),
      loading: true,
      sections: [],
    };
    this.renderer.setAmud(pseudoLoadingAmud);
    let showedError = false;
    const wrappedErrorCallback = (error) => {
      if (options.finished) return; // A cached page has already been shown, so don't override that.
      if (options.errorCallback) options.errorCallback(error);
      showedError = true;
      this.renderer.setAmud({...pseudoLoadingAmud, errorEnglish: extractError(error)});
    };
    setTimeout(() => {
      if (!showedError) {
        wrappedErrorCallback({responseText: "Still going..."});
      }
    }, 10_000);
    this.requestQueue.add(() => {
      return this.getAndCacheSection(section, wrappedErrorCallback).then((results) => {
        options.finished = true;
        this.renderer.setAmud(results);
        refreshPageState();
        if (options.callback) options.callback();
        gtag("event", "section_loaded", {section});
      });
    });
    if (options.newUrl) {
      this.updateUrl(options.newUrl);
    }
    refreshPageState();
  }

  updateUrl(newUrl) {
    const oldUrl = window.location.href;
    mainCache().then(cache => {
      cache.match(oldUrl).then(cachedResponse => {
        if (cachedResponse) {
          cache.put(newUrl, cachedResponse.clone());
        }
      });
    });
    window.history.replaceState({}, "", newUrl);
  }

  newUrlRange(start, end) {
    const masechet = amudMetadata().masechet.replace(/ /g, "_");
    const newUrl = `${window.location.origin}/${masechet}/${start}`;
    if (start === end) {
      return newUrl;
    }
    return `${newUrl}/to/${end}`;
  }

  addNextSection() {
    const metadata = amudMetadata();
    const nextSection = this.renderer.navigationExtension.next();
    this.requestSection(nextSection, {
      newUrl: this.newUrlRange(metadata.amudStart, nextSection),
      callback: () => this.preloadNextSection(),
    });

    gtag("event", "load_section", {
      direction: "next",
      section: nextSection,
    });
  }

  preloadNextSection() {
    if (localStorage.disablePrecaching === "true") return;
    if (this.renderer.navigationExtension.hasNext()) {
      this.requestQueue.add(
        () => this.getAndCacheSection(this.renderer.navigationExtension.next()));
    }
  }

  addPreviousSection() {
    const metadata = amudMetadata();
    const previousSection = this.renderer.navigationExtension.previous();
    this.requestSection(previousSection, {
      newUrl: this.newUrlRange(previousSection, metadata.amudEnd),
      callback: () => {
        setTimeout(() => setWindowTop("#amud-" + metadata.amudStart), 10);
        this.preloadPreviousSection();
      },
    });

    gtag("event", "load_section", {
      direction: "previous",
      section: previousSection,
    });
  }

  preloadPreviousSection() {
    if (localStorage.disablePrecaching === "true") return;
    if (this.renderer.navigationExtension.hasPrevious()) {
      this.requestQueue.add(
        () => this.getAndCacheSection(this.renderer.navigationExtension.previous()));
    }
  }

  removeFirstSection() {
    this._removeSection(1, -1);
  }

  removeLastSection() {
    this._removeSection(0, -2);
  }

  _removeSection(newStart, newEnd) {
    const range = amudMetadata().range();
    this.updateUrl(this.newUrlRange(range.at(newStart), range.at(newEnd)));
    this.renderer.forceUpdate();
    refreshPageState();
  }

  main() {
    $(document).ready(() => {
      serviceWorkerMain();

      const metadata = amudMetadata();
      gtag("set", {section: metadata.masechet});

      const amudRange = metadata.range();

      this.renderer.register("results");

      const switchToPagesView = once(() => {
        this.renderer.declareReady();
        $("#initial-load-spinner").hide();
        $("#initial-load-error").hide();
        onceDocumentReady.declareReady();
      });

      const requestOptions = {
        counter: 0,
        pageCount: amudRange.length,
        callback: () => {
          requestOptions.counter++;
          if (requestOptions.counter !== requestOptions.pageCount) {
            return;
          }

          switchToPagesView();

          maybeSetInitialScrollPosition();
          periodicallySaveScrollPosition();
        },
        errorCallback: (error) => {
          $("#initial-load-error").text(extractError(error));
        },
      };
      for (const amud of amudRange) {
        this.requestSection(amud, requestOptions);
      }

      const enablePagesRenderAfterSeconds = (
        localStorage.enablePagesRenderAfterSeconds
          ? parseFloat(localStorage.enablePagesRenderAfterSeconds)
          : 3
      );

      setTimeout(switchToPagesView, enablePagesRenderAfterSeconds * 1000);
    });

    onceDocumentReady.execute(registerRefSelectionSnackbarListener);

    onceDocumentReady.execute(() => {
      this.preloadNextSection();
      this.preloadPreviousSection();
    });

    this.driveClient.signInStatusListener = () => {
      if (this.driveClient.isSignedIn) {
        return;
      }

      const useHebrew = localStorage.languageOption === "hebrew";
      const snackbarText = useHebrew ? "לשמור הערות לGoogle Drive?" : "Save notes to Google Drive?";
      const noThanks = useHebrew ? "לא תודה" : "No thanks";
      const signIn = useHebrew ? "להכנס" : "Sign in";
      snackbars.googleSignIn.show(snackbarText, [
        {
          text: noThanks,
          onClick: () => snackbars.googleSignIn.dismissButtonImpl(),
        },
        {
          text: signIn,
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
        snackbars.errors.show(Object.values(this.driveClient.errors).join("<br><br>"), {
          text: "Dismiss",
          onClick: () => {
            this.driveClient.clearErrors();
            snackbars.errors.hide();
          },
        });
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
new FontCache().loadAll();
