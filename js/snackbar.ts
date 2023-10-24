/* global gtag */
import {sendEvent} from "./event";
import {$} from "./jquery";
import {LocalStorageInt} from "./localStorage";
import PREFERENCES_PAGE_VERSION from "./preferences_version";

const moveSnackbarOffscreen = () => $("#snackbar").css("bottom", -400).promise();
const hideSnackbar = () => $("#snackbar").animate({bottom: -400}).promise();

function addContainer(kind: Kind): void {
  const classes = [kind.cssClass, ...(kind.extraCssClasses || [])].join(" ");
  $(`#snackbar`).append(
    `<div class="${classes}">
       <div class="snackbar-text"></div>
       <div class="snackbar-buttons"></div>
     </div>`);
}

export interface Button {
  text: string;
  onClick: () => void;
}
type MaybeButtons = Button | Button[];

function updateSnackbar(kind: Kind, labelHtml: string, maybeButtons: MaybeButtons): void {
  let $container = $(`#snackbar .${kind.cssClass}`);
  if ($container.length === 0) {
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

  const buttonClasses = [
    "mdl-button",
    "mdl-js-button",
    (localStorage.darkMode !== "true") ? "mdl-button--colored" : "mdl-button--normal-text-color",
  ].join(" ");
  $container.find(".snackbar-buttons").html(
    buttons
      .map(button => `<button class="${buttonClasses}" ${style}>${button.text}</button>`)
      .join(""));

  const buttonElements = $container.find("button");
  for (let i = 0; i < buttonElements.length; i++) {
    $(buttonElements[i]).click(buttons[i].onClick);
  }
}

function displaySnackbar(kind: Kind, labelHtml: string, buttons: MaybeButtons): Promise<unknown> {
  updateSnackbar(kind, labelHtml, buttons);

  // Ensure that any hide animation finishes immediately and restart the showing of the snackbar
  $(`#snackbar .${kind.cssClass}`).stop().hide().slideToggle();

  return $("#snackbar").animate({bottom: 0}, 200).promise();
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
  ignoreDismissesBecauseExponentialBackoff?: boolean;
}

class Kind implements AbstractKind {
  prefix: string | undefined;
  customShowLogic: (() => boolean) | undefined;
  shouldResetShowCount: (() => boolean) | undefined;
  maxShowCount: number | undefined;
  cssClass: string;
  extraCssClasses: string[] | undefined;
  ignoreDismissesBecauseExponentialBackoff: boolean | undefined;

  constructor(kind: AbstractKind) {
    this.prefix = kind.prefix;
    this.customShowLogic = kind.customShowLogic;
    this.shouldResetShowCount = kind.shouldResetShowCount;
    this.maxShowCount = kind.maxShowCount;
    this.cssClass = kind.cssClass;
    this.extraCssClasses = kind.extraCssClasses;
    this.ignoreDismissesBecauseExponentialBackoff = kind.ignoreDismissesBecauseExponentialBackoff;
  }

  shownCountString(): string {
    return `${this.prefix}SnackbarShownCount`;
  }

  shownCount(): number {
    return new LocalStorageInt(this.shownCountString()).get() || 0;
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
    customShowLogic: () => !hasSeenLatestPreferences() || true,
    shouldResetShowCount: () => {
      const lastVersion = new LocalStorageInt("lastVersionOfPreferencesPageResetTo");
      if (lastVersion.get() !== PREFERENCES_PAGE_VERSION) {
        lastVersion.set(PREFERENCES_PAGE_VERSION);
        return true;
      }
      return false;
    },
    maxShowCount: 3,
    cssClass: "preferencesNudge",
  }),

  GOOGLE_SIGN_IN: new Kind({
    prefix: "googleSignIn",
    cssClass: "googleSignIn",
    customShowLogic: () => {
      const showCount = new LocalStorageInt("googleSignInShowCounter").getAndIncrement();
      let modulo = 50;
      if (showCount < 5) modulo = 1;
      else if (showCount < 20) modulo = 2;
      else if (showCount < 50) modulo = 4;
      else if (showCount < 100) modulo = 10;
      return showCount % modulo === 0;
    },
    maxShowCount: 9999999,
  }),

  TEXT_SELECTION: new Kind({
    cssClass: "textSelection",
  }),

  ERRORS: new Kind({
    cssClass: "errors",
    extraCssClasses: ["mdl-color-text--accent"],
  }),

  SHARE: new Kind({
    prefix: "shareSnackbar",
    cssClass: "share-talmud-page",
    ignoreDismissesBecauseExponentialBackoff: true,
    customShowLogic: () => {
      const showCount = new LocalStorageInt("shareSnackbarShowCounter").getAndIncrement();
      if (showCount === 0) return false;
      if (showCount < 400) {
        return showCount % 50 === 0;
      }
      return showCount % 100 === 0;
    },
    maxShowCount: 9999999,
  }),
};

class Snackbar {
  kind: Kind;
  snackbarManager: SnackbarManager;
  constructor(kind: Kind, snackbarManager: SnackbarManager) {
    this.kind = kind;
    this.snackbarManager = snackbarManager;
  }

  show(labelHtml: string, buttons: MaybeButtons): Promise<unknown> {
    if (this.kind.prefix) {
      // Delay incrementing the shown count to make sure that the use didn't reload the page quickly
      // and the snackbar was never actually shown.
      setTimeout(() => this.kind.incrementShownCount(), 5 * 1000);
    }

    return displaySnackbar(this.kind, labelHtml, buttons);
  }

  update(labelHtml: string, buttons: MaybeButtons) {
    updateSnackbar(this.kind, labelHtml, buttons);
  }

  hide() {
    const $section = $(`#snackbar .${this.kind.cssClass}`);
    return $section.slideToggle(200).promise().then(() => {
      $section.remove();
      if ($("#snackbar").children().length === 0) {
        return hideSnackbar();
      }
      return undefined;
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
  show(labelHtml: string, buttons: MaybeButtons): Promise<unknown> {
    if (this.snackbarManager.startupKind === this.kind) {
      return super.show(labelHtml, buttons);
    }
    return Promise.resolve();
  }
}

class SnackbarManager {
  preferencesNudge: Snackbar;
  googleSignIn: Snackbar;
  textSelection: Snackbar;
  errors: Snackbar;
  share: Snackbar;

  startupKind: Kind | undefined;

  constructor() {
    for (const kind of [Kinds.PREFERENCES_NUDGE, Kinds.GOOGLE_SIGN_IN, Kinds.SHARE]) {
      if (kind.shouldResetShowCount && kind.shouldResetShowCount()) {
        kind.setShownCount(0);
        delete localStorage[kind.dismissedString()];
      }
      if ((!localStorage[kind.dismissedString()] || kind.ignoreDismissesBecauseExponentialBackoff)
          && kind.customShowLogic!()
          && kind.shownCount() < kind.maxShowCount!) {
        this.startupKind = kind;
        break;
      }
    }

    this.preferencesNudge = new StartupSnackbar(Kinds.PREFERENCES_NUDGE, this);
    this.googleSignIn = new StartupSnackbar(Kinds.GOOGLE_SIGN_IN, this);
    this.share = new StartupSnackbar(Kinds.SHARE, this);
    this.textSelection = new Snackbar(Kinds.TEXT_SELECTION, this);
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
          (window as any).showPreferences();
        },
      },
      {
        text: "Dismiss",
        onClick: () => snackbars.preferencesNudge.dismissButtonImpl(),
      },
    ]);

  const shareData = {url: "https://talmud.page"};
  if (navigator.canShare && navigator.canShare(shareData)) {
    const text = [
      "Share talmud.page with a friend?",
      "Know someone who would enjoy learning here?",
      "Spread the talmud.page love!",
      "talmud.page isn't well known. Help change that?",
    ].sort(() => Math.random() - .5)[0];
    snackbars.share.show(text, [
      {
        text: "Dismiss",
        onClick: () => {
          sendEvent({share: false, text, subject: "Share dismissed"});
          snackbars.share.dismissButtonImpl();
        },
      },
      {
        text: `<i class="material-icons">share</i>`,
        onClick: () => {
          snackbars.share.dismissButtonImpl();
          navigator.share(shareData);
          sendEvent({share: true, text, subject: "Share"});
        },
      },
    ]);
  }
});
