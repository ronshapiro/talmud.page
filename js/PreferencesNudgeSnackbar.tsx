import * as React from "react";
import { useSnackbar, SnackbarConfig } from "./SnackbarProvider";
import { LocalStorageInt } from "./localStorage"; // Assuming this is exportable
import PREFERENCES_PAGE_VERSION from "./preferences_version"; // Assuming this is exportable

// gtag and window.showPreferences would ideally be typed or handled via a service
declare global {
  interface Window {
    showPreferences: () => void;
    gtag: (...args: any[]) => void;
  }
}

const { useEffect, useCallback } = React;

const LAST_SEEN_PREFERENCES_VERSION_LS_KEY = "lastVersionOfPreferencesPageResetTo";
const PREFERENCES_NUDGE_SNACKBAR_SHOWN_COUNT_LS_KEY = "preferencePageSnackbarShownCount";
const PREFERENCES_NUDGE_SNACKBAR_DISMISSED_LS_KEY = "preferencePageSnackbarShownDismissed";

const MAX_SHOW_COUNT = 3;
const SNACKBAR_ID = "preferences-nudge-snackbar";

// Helper to get/set localStorage values, mirroring Kind class logic
const getShownCount = () => new LocalStorageInt(PREFERENCES_NUDGE_SNACKBAR_SHOWN_COUNT_LS_KEY).get() || 0;
const setShownCount = (count: number) => new LocalStorageInt(PREFERENCES_NUDGE_SNACKBAR_SHOWN_COUNT_LS_KEY).set(count);
const incrementShownCount = () => setShownCount(getShownCount() + 1);
const getDismissed = () => localStorage.getItem(PREFERENCES_NUDGE_SNACKBAR_DISMISSED_LS_KEY) === "true";
const setDismissed = () => localStorage.setItem(PREFERENCES_NUDGE_SNACKBAR_DISMISSED_LS_KEY, "true");
const deleteDismissed = () => localStorage.removeItem(PREFERENCES_NUDGE_SNACKBAR_DISMISSED_LS_KEY);

const hasSeenLatestPreferences = () => {
  return new LocalStorageInt(LAST_SEEN_PREFERENCES_VERSION_LS_KEY).get() === PREFERENCES_PAGE_VERSION;
};

const shouldResetShowCount = () => {
  if (!hasSeenLatestPreferences()) {
    new LocalStorageInt(LAST_SEEN_PREFERENCES_VERSION_LS_KEY).set(PREFERENCES_PAGE_VERSION);
    return true;
  }
  return false;
};

export function PreferencesNudgeSnackbarTrigger() {
  const { showSnackbar, hideSnackbar } = useSnackbar();

  const handlePreferencesClick = useCallback(() => {
    if (window.gtag) {
      window.gtag("event", "snackbar.preferencePage.clicked");
    }
    if (window.showPreferences) {
      window.showPreferences();
    }
    hideSnackbar(SNACKBAR_ID); // Dismiss after clicking
  }, [hideSnackbar]);

  const handleDismissClick = useCallback(() => {
    if (window.gtag) {
      window.gtag("event", "snackbar.preferencePage.dismissed");
    }
    setDismissed();
    hideSnackbar(SNACKBAR_ID);
  }, [hideSnackbar]);

  useEffect(() => {
    // Logic from the old SnackbarManager constructor and PREFERENCES_NUDGE Kind
    if (shouldResetShowCount()) {
      setShownCount(0);
      deleteDismissed();
    }

    const isDismissed = getDismissed();
    const currentShowCount = getShownCount();
    // Original customShowLogic: !hasSeenLatestPreferences() || true -> this seems to always be true if not dismissed.
    // Let's simplify to: always true unless dismissed or count exceeded.
    // The `|| true` in original `customShowLogic: () => !hasSeenLatestPreferences() || true` for PREFERENCES_NUDGE
    // seems like it might have been a temporary override or a bug, as it makes the `!hasSeenLatestPreferences()` part redundant.
    // For this migration, I'll stick to the combined logic: not dismissed, count < max, and the startupKind logic.
    // The old code picked ONE startup snackbar. Here, each can decide to show.
    // We might need a mechanism to ensure only one "startup" snackbar shows if that's desired.
    // For now, this component will manage its own display logic.

    const customShowLogic = !hasSeenLatestPreferences(); // Based on the intent of the original code for "new/updated preferences"

    if (!isDismissed && customShowLogic && currentShowCount < MAX_SHOW_COUNT) {
      // Delay incrementing the shown count
      setTimeout(() => incrementShownCount(), 5 * 1000);

      const useHebrew = localStorage.languageOption === "hebrew";
      const updatedOptions = useHebrew ? "בדקו הגדרות חדשות" : "Check out the updated options!";
      const availableOptions = useHebrew ? "בדקו הגדרות אפשריות" : "Check out the available options!";
      const message = hasSeenLatestPreferences() ? updatedOptions : availableOptions;

      const snackbarConfig: SnackbarConfig = {
        id: SNACKBAR_ID,
        message: message,
        buttons: [
          {
            text: useHebrew ? "הגדרות" : "Preferences",
            onClick: handlePreferencesClick,
          },
          {
            text: useHebrew ? "סגור" : "Dismiss",
            onClick: handleDismissClick,
          },
        ],
        kind: "preferences-nudge", // For specific styling if needed
        autoHideDuration: 10000, // Example: 10 seconds, or null to require manual dismissal
      };
      showSnackbar(snackbarConfig);
    }
  }, [showSnackbar, handlePreferencesClick, handleDismissClick]);

  return null; // This component is a trigger, it doesn't render anything itself
}
