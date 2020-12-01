/* global gtag */
import $ from "jquery";
import PREFERENCES_PAGE_VERSION from "./preferences_version.js";

const moveSnackbarOffscreen = () => $("#snackbar").css("bottom", -400);
const hideSnackbar = () => $("#snackbar").animate({bottom: -400});

const BUTTON_CLASSES = 'class="mdl-button mdl-js-button mdl-button--colored"';

const addContainer = kind => {
  const classes = [kind.cssClass, ...(kind.extraCssClasses || [])].join(" ");
  $(`#snackbar`).append(
    `<div class="${classes}">
       <div class="snackbar-text"></div>
       <div class="snackbar-buttons"></div>
     </div>`);
};

const updateSnackbar = (kind, labelHtml, buttons) => {
  let $container = $(`#snackbar .${kind.cssClass}`);
  const addingContainer = !$container.length;
  if (addingContainer) {
    addContainer(kind);
    $container = $(`#snackbar .${kind.cssClass}`);
  }
  $container.find(".snackbar-text").html(labelHtml);

  const buttonsDiv = $container.find(".snackbar-buttons").html("");
  let style = "";
  if (!buttons) {
    buttons = ["hidden"];
    style = 'style="visibility:hidden"';
  } else if (!buttons.length) {
    buttons = [buttons];
  }

  // TODO: replace with map and then remove the initial setting of html("")
  for (const button of buttons) {
    buttonsDiv.append(`<button ${BUTTON_CLASSES} ${style}>${button.text}</button>`);
  }

  const buttonElements = $container.find("button");
  for (let i = 0; i < buttonElements.length; i++) {
    $(buttonElements[i]).click(buttons[i].onClick);
  }

  // Ensure that any hide animation finishes immediately and restart the showing of the snackbar
  $container.stop().hide().slideToggle();
};

const displaySnackbar = (kind, labelHtml, buttons) => {
  updateSnackbar(kind, labelHtml, buttons);

  $("#snackbar").animate({bottom: 0});
};

const hasSeenLatestPreferences = () => {
  if (localStorage.lastViewedVersionOfPreferencesPage) {
    return parseInt(localStorage.lastViewedVersionOfPreferencesPage) === PREFERENCES_PAGE_VERSION;
  }
  return false;
};

const Kind = {
  PREFERENCES_NUDGE: {
    prefix: "preferencePage",
    customShowLogic: () => {
      return window.location.pathname !== "/preferences" && !hasSeenLatestPreferences();
    },
    shouldResetShowCount: () => {
      if (parseInt(localStorage.lastVersionOfPreferencesPageResetTo) !== PREFERENCES_PAGE_VERSION) {
        localStorage.lastVersionOfPreferencesPageResetTo = PREFERENCES_PAGE_VERSION;
        return true;
      }
      return false;
    },
    maxShowCount: 3,
    cssClass: "preferencesNudge",
  },
  GOOGLE_SIGN_IN: {
    prefix: "googleSignIn",
    customShowLogic: () => !localStorage.hasSignedInWithGoogle,
    maxShowCount: 3,
    cssClass: "googleSignIn",
  },
  TEXT_SELECTION: {
    cssClass: "textSelection",
  },
  PREFERENCES_SAVED: {
    cssClass: "preferencesSaved",
  },
  ERRORS: {
    cssClass: "errors",
    extraCssClasses: ["mdl-color-text--accent"],
  },
};

const shownCountString = kind => `${kind.prefix}SnackbarShownCount`;
const shownCount = kind => parseInt(localStorage[shownCountString(kind)]) || 0;
const setShownCount = (kind, newCount) => {
  localStorage[shownCountString(kind)] = newCount;
};
const incrementShownCount = kind => {
  setShownCount(kind, shownCount(kind) + 1);
};

const dismissedString = kind => `${kind.prefix}SnackbarShownDismissed`;

class Snackbar {
  constructor(kind, snackbarManager) {
    this.kind = kind;
    this.snackbarManager = snackbarManager;
  }

  show(...args) {
    if (this.kind.prefix) {
      // Delay incrementing the shown count to make sure that the use didn't reload the page quickly
      // and the snackbar was never actually shown.
      setTimeout(() => incrementShownCount(this.kind), 5 * 1000);
    }

    displaySnackbar(this.kind, ...args);
  }

  hide() {
    const $section = $(`#snackbar .${this.kind.cssClass}`);
    $section.slideToggle(200, () => {
      $section.remove();
      if ($("#snackbar").children().length === 0) {
        hideSnackbar();
      }
    });
  }

  dismissButtonImpl() {
    const {prefix} = this.kind;
    if (prefix) {
      gtag("event", `snackbar.${prefix}.dismissed`);
      localStorage[dismissedString(prefix)] = true;
    }
    this.hide();
  }
}

class StartupSnackbar extends Snackbar {
  show(...args) {
    if (this.snackbarManager.startupKind === this.kind) {
      super.show(...args);
    }
  }
}

class SnackbarManager {
  constructor() {
    for (const kind of [Kind.PREFERENCES_NUDGE, Kind.GOOGLE_SIGN_IN]) {
      if (kind.shouldResetShowCount && kind.shouldResetShowCount()) {
        setShownCount(kind, 0);
        delete localStorage[dismissedString(kind)];
      }
      if (kind.customShowLogic()
          && shownCount(kind) < kind.maxShowCount
          && !localStorage[dismissedString(kind)]) {
        this.startupKind = kind;
        break;
      }
    }

    this.preferencesNudge = new StartupSnackbar(Kind.PREFERENCES_NUDGE, this);
    this.googleSignIn = new StartupSnackbar(Kind.GOOGLE_SIGN_IN, this);
    this.textSelection = new Snackbar(Kind.TEXT_SELECTION, this);
    this.preferencesSaved = new Snackbar(Kind.PREFERENCES_SAVED, this);
    // TODO: make each error it's own snackbar? That way each can animate on its own
    this.errors = new Snackbar(Kind.ERRORS, this);
  }
}

const snackbars = new SnackbarManager();

$(document).ready(() => {
  moveSnackbarOffscreen();

  snackbars.preferencesNudge.show(
    (localStorage.lastViewedVersionOfPreferencesPage
     ? "Check out the updated options!"
     : "Check out the available options!"),
    [
      {
        text: "Preferences",
        onClick: () => {
          gtag("event", "snackbar.preferencesPage.clicked");
          window.location.pathname = "/preferences";
        },
      },
      {
        text: "Dismiss",
        onClick: () => snackbars.preferencesNudge.dismissButtonImpl(),
      },
    ]);
});

module.exports = {snackbars};
