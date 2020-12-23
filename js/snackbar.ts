/* global gtag */
import $ from "jquery";
import PREFERENCES_PAGE_VERSION from "./preferences_version";

const moveSnackbarOffscreen = () => $("#snackbar").css("bottom", -400);
const hideSnackbar = () => $("#snackbar").animate({bottom: -400});

const BUTTON_CLASSES = 'class="mdl-button mdl-js-button mdl-button--colored"';

function addContainer(kind: Kind): void {
  const classes = [kind.cssClass, ...(kind.extraCssClasses || [])].join(" ");
  $(`#snackbar`).append(
    `<div class="${classes}">
       <div class="snackbar-text"></div>
       <div class="snackbar-buttons"></div>
     </div>`);
}

interface Button {
  text: string;
  onClick: () => void;
}
type MaybeButtons = Button | Button[];

function updateSnackbar(kind: Kind, labelHtml: string, maybeButtons: MaybeButtons): void {
  let $container = $(`#snackbar .${kind.cssClass}`);
  const addingContainer = !$container.length;
  if (addingContainer) {
    addContainer(kind);
    $container = $(`#snackbar .${kind.cssClass}`);
  }
  $container.find(".snackbar-text").html(labelHtml);

  let style = "";
  let buttons: Button[];
  if (!maybeButtons) {
    buttons = [{} as Button];
    style = 'style="visibility:hidden"';
  } else if (Array.isArray(maybeButtons)) {
    buttons = maybeButtons;
  } else {
    buttons = [maybeButtons];
  }

  $container.find(".snackbar-buttons").html(
    buttons
      .map(button => `<button ${BUTTON_CLASSES} ${style}>${button.text}</button>`)
      .join(""));

  const buttonElements = $container.find("button");
  for (let i = 0; i < buttonElements.length; i++) {
    $(buttonElements[i]).click(buttons[i].onClick);
  }

  // Ensure that any hide animation finishes immediately and restart the showing of the snackbar
  $container.stop().hide().slideToggle();
}

function displaySnackbar(kind: Kind, labelHtml: string, buttons: MaybeButtons): void {
  updateSnackbar(kind, labelHtml, buttons);

  $("#snackbar").animate({bottom: 0});
}

const hasSeenLatestPreferences = () => {
  if (localStorage.lastViewedVersionOfPreferencesPage) {
    return parseInt(localStorage.lastViewedVersionOfPreferencesPage) === PREFERENCES_PAGE_VERSION;
  }
  return false;
};

interface AbstractKind {
  prefix?: string;
  customShowLogic?: () => boolean;
  shouldResetShowCount?: () => boolean;
  maxShowCount?: number;
  cssClass: string;
  extraCssClasses?: string[];
}

class Kind implements AbstractKind {
  prefix: string | undefined;
  customShowLogic: (() => boolean) | undefined;
  shouldResetShowCount: (() => boolean) | undefined;
  maxShowCount: number | undefined;
  cssClass: string;
  extraCssClasses: string[] | undefined;

  constructor(kind: AbstractKind) {
    this.prefix = kind.prefix;
    this.customShowLogic = kind.customShowLogic;
    this.shouldResetShowCount = kind.shouldResetShowCount;
    this.maxShowCount = kind.maxShowCount;
    this.cssClass = kind.cssClass;
    this.extraCssClasses = kind.extraCssClasses;
  }

  shownCountString(): string {
    return `${this.prefix}SnackbarShownCount`;
  }

  shownCount(): number {
    return parseInt(localStorage[this.shownCountString()]) || 0;
  }

  setShownCount(newCount: number): void {
    localStorage[this.shownCountString()] = newCount;
  }

  incrementShownCount(): void {
    this.setShownCount(this.shownCount() + 1);
  }

  dismissedString(): string {
    return `${this.prefix}SnackbarShownDismissed`;
  }
}

const Kinds = {
  PREFERENCES_NUDGE: new Kind({
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
  }),

  GOOGLE_SIGN_IN: new Kind({
    prefix: "googleSignIn",
    customShowLogic: () => !localStorage.hasSignedInWithGoogle,
    maxShowCount: 3,
    cssClass: "googleSignIn",
  }),

  TEXT_SELECTION: new Kind({
    cssClass: "textSelection",
  }),

  PREFERENCES_SAVED: new Kind({
    cssClass: "preferencesSaved",
  }),

  ERRORS: new Kind({
    cssClass: "errors",
    extraCssClasses: ["mdl-color-text--accent"],
  }),
};

class Snackbar {
  kind: Kind;
  snackbarManager: SnackbarManager;
  constructor(kind: Kind, snackbarManager: SnackbarManager) {
    this.kind = kind;
    this.snackbarManager = snackbarManager;
  }

  show(labelHtml: string, buttons: MaybeButtons) {
    if (this.kind.prefix) {
      // Delay incrementing the shown count to make sure that the use didn't reload the page quickly
      // and the snackbar was never actually shown.
      setTimeout(() => this.kind.incrementShownCount(), 5 * 1000);
    }

    displaySnackbar(this.kind, labelHtml, buttons);
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
      localStorage[this.kind.dismissedString()] = true;
    }
    this.hide();
  }
}

class StartupSnackbar extends Snackbar {
  show(labelHtml: string, buttons: MaybeButtons) {
    if (this.snackbarManager.startupKind === this.kind) {
      super.show(labelHtml, buttons);
    }
  }
}

class SnackbarManager {
  preferencesNudge: Snackbar;
  googleSignIn: Snackbar;
  textSelection: Snackbar;
  preferencesSaved: Snackbar;
  errors: Snackbar;

  startupKind: Kind | undefined;

  constructor() {
    for (const kind of [Kinds.PREFERENCES_NUDGE, Kinds.GOOGLE_SIGN_IN]) {
      if (kind.shouldResetShowCount && kind.shouldResetShowCount()) {
        kind.setShownCount(0);
        delete localStorage[kind.dismissedString()];
      }
      if (kind.customShowLogic!()
          && kind.shownCount() < kind.maxShowCount!
          && !localStorage[kind.dismissedString()]) {
        this.startupKind = kind;
        break;
      }
    }

    this.preferencesNudge = new StartupSnackbar(Kinds.PREFERENCES_NUDGE, this);
    this.googleSignIn = new StartupSnackbar(Kinds.GOOGLE_SIGN_IN, this);
    this.textSelection = new Snackbar(Kinds.TEXT_SELECTION, this);
    this.preferencesSaved = new Snackbar(Kinds.PREFERENCES_SAVED, this);
    // TODO: make each error it's own snackbar? That way each can animate on its own
    this.errors = new Snackbar(Kinds.ERRORS, this);
  }
}

export const snackbars = new SnackbarManager();

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
