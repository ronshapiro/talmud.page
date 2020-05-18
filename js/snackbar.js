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

const hasSeenPreferencesSnackbarEnough = function() {
  return parseInt(localStorage.preferencePageCounter) < 3;
}

const PREFERENCES_PAGE_SNACKBAR_COUNT_MAX = 3;

$(document).ready(function() {
  moveSnackbarOffscreen();

  let preferencePageSnackbarShownCount = localStorage.preferencePageSnackbarShownCount || 0;
  preferencePageSnackbarShownCount++;

  if (window.location.pathname !== "/preferences"
      && !hasSeenLatestPreferences()
      && preferencePageSnackbarShownCount <= PREFERENCES_PAGE_SNACKBAR_COUNT_MAX) {
    localStorage.preferencePageSnackbarShownCount = preferencePageSnackbarShownCount;
    displaySnackbar("Check out the available options available!", [
      {
        text: "Preferences",
        onClick: function() {
          gtag("event", "snackbar.preferences_page.clicked");
          window.location.pathname = "/preferences"
        },
      },
      {
        text: "Dismiss",
        onClick: function() {
          gtag("event", "snackbar.preferences_page.dismissed");
          localStorage.preferencePageSnackbarShownCount = PREFERENCES_PAGE_SNACKBAR_COUNT_MAX;
          hideSnackbar();
        },
      },
    ]);
  } else if (window.driveClient && !localStorage.hasSignedInWithGoogle) {
    displaySnackbar("", [
      {
        text: "Save your favorites: Sign in with Google",
        onClick: () => {
          driveClient.addListener(function() {
            if (this.stopListening) {
              return;
            }
            if (driveClient.isSignedIn) {
              hideSnackbar();
              this.stopListening = true;
            }
          });
          driveClient.signIn();
        },
      },
      {
        text: "Dismiss",
        onClick: () => {
          localStorage.hasSignedInWithGoogle = "ignored";
          hideSnackbar();
        }
      },
    ]);
  }
});

module.exports = {
  hideSnackbar: hideSnackbar,
  displaySnackbar: displaySnackbar,
}
