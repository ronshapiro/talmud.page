const moveSnackbarOffscreen = () => $("#snackbar").css("bottom", -400);
const hideSnackbar = () => $("#snackbar").animate({"bottom": -400});

const updateSnackbar = function(labelHtml, buttons) {
  $("#snackbar-text").html(labelHtml);
  const buttonsDiv = $("#snackbar-buttons").html("");
  if (!buttons) {
    buttons = [];
  } else if (!buttons.length) {
    buttons = [buttons];
  }
  for (const button of buttons) {
    buttonsDiv.append(
      `<button class="mdl-button mdl-js-button mdl-button--colored">${button.text}</button>`);
  }

  const buttonElements = $("#snackbar-buttons button");
  for (let i = 0; i < buttonElements.length; i++) {
    $(buttonElements[i]).click(buttons[i].onClick);
  }
}

const displaySnackbar = function(labelHtml, buttons) {
  updateSnackbar(labelHtml, buttons);

  moveSnackbarOffscreen();
  $("#snackbar").animate({"bottom": 0});
}

const hasSeenLatestPreferences = function() {
  if (localStorage.lastViewedVersionOfPreferencesPage) {
    return parseInt(localStorage.lastViewedVersionOfPreferencesPage) === 1;
  }
  return false;
}

$(document).ready(function() {
  moveSnackbarOffscreen();

  snackbars.preferencesNudge.show(
    "Check out the available options!", [
      {
        text: "Preferences",
        onClick: function() {
          gtag("event", "snackbar.preferencesPage.clicked");
          window.location.pathname = "/preferences"
        },
      },
      {
        text: "Dismiss",
        onClick: () => snackbars.preferencesNudge.dismissButtonImpl(),
      },
    ]);
});

const Kind = {
  PREFERENCES_NUDGE: {
    prefix: "preferencePage",
    customShowLogic: () => {
      return window.location.pathname !== "/preferences" && !hasSeenLatestPreferences();
    },
    maxShowCount: 3,
  },
  GOOGLE_SIGN_IN: {
    prefix: "googleSignIn",
    customShowLogic: () => !localStorage.hasSignedInWithGoogle,
    maxShowCount: 3,
  },
  TEXT_SELECTION: {},
  PREFERENCES_SAVED: {},
};

const shownCountString = kind => `${kind.prefix}SnackbarShownCount`;
const shownCount = kind => parseInt(localStorage[shownCountString(kind)]) || 0;
const incrementShownCount = kind => localStorage[shownCountString(kind)] = shownCount(kind) + 1;

const dismissedString = kind => `${kind.prefix}SnackbarShownDismissed`;

class SnackbarManager {
  constructor() {
    for (const kind of [Kind.PREFERENCES_NUDGE, Kind.GOOGLE_SIGN_IN]) {
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
  }
}

class Snackbar {
  constructor(kind, snackbarManager) {
    this.kind = kind;
    this.snackbarManager = snackbarManager;
  }

  show() {
    if (this.snackbarManager.currentlyDisplayedKind &&
        this.snackbarManager.currentlyDisplayedKind != this.kind) {
      return;
    }
    if (this.kind.prefix) {
      // Delay incrementing the shown count to make sure that the use didn't reload the page quickly
      // and the snackbar was never actually shown.
      setTimeout(() => incrementShownCount(this.kind), 5 * 1000);
    }

    this.snackbarManager.currentlyDisplayedKind = this.kind;
    displaySnackbar(...arguments);
  }

  hide() {
    if (this.snackbarManager.currentlyDisplayedKind != this.kind) {
      return;
    }
    hideSnackbar();
    this.snackbarManager.currentlyDisplayedKind = undefined;
  }

  dismissButtonImpl() {
    const prefix = this.kind.prefix;
    if (prefix) {
      gtag("event", `snackbar.${prefix}.dismissed`);
      localStorage[dismissedString(prefix)] = true;
    }
    this.hide();
  }
}

class StartupSnackbar extends Snackbar {
  constructor(kind, snackbarManager) {
    super(kind, snackbarManager);
  }

  show() {
    if (this.snackbarManager.startupKind === this.kind) {
      super.show(...arguments);
    }
  }
}

const snackbars = new SnackbarManager();

module.exports = {
  snackbars: snackbars,
}
