import * as React from "react";
import { useSnackbar, SnackbarConfig } from "./SnackbarProvider";
import { LocalStorageInt } from "./localStorage"; // Assuming this is exportable
// import {sendEvent} from "./event"; // Assuming this is exportable and typed

// gtag and navigator.share would ideally be typed or handled via a service
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
  interface Navigator {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  }
}
interface ShareData {
  url?: string;
  text?: string;
  title?: string;
  files?: File[];
}

// If sendEvent is used, its signature is needed. For example:
// declare function sendEvent(eventData: { share: boolean; text: string; subject: string }): void;
// For now, I will assume it's available globally or imported if modular.
// If it's like `import {sendEvent} from "./event";` ensure ./event.ts is compatible.
// Let's assume a placeholder if not typed for now.
const sendEvent = (eventData: any) => {
  console.log("sendEvent called with:", eventData);
  // Actual implementation should be imported or available globally
};


const { useEffect, useCallback } = React;

const SHARE_SNACKBAR_SHOW_COUNTER_LS_KEY = "shareSnackbarShowCounter"; // From original logic
const SHARE_SNACKBAR_SHOWN_COUNT_LS_KEY = "shareSnackbarSnackbarShownCount"; // For consistency with other snackbars
const SHARE_SNACKBAR_DISMISSED_LS_KEY = "shareSnackbarSnackbarShownDismissed";

const MAX_SHOW_COUNT = 9999999; // Effectively infinite
const SNACKBAR_ID = "share-talmud-page-snackbar";

// Helper functions
const getSelfShownCount = () => new LocalStorageInt(SHARE_SNACKBAR_SHOWN_COUNT_LS_KEY).get() || 0;
const incrementSelfShownCount = () => {
  new LocalStorageInt(SHARE_SNACKBAR_SHOWN_COUNT_LS_KEY).set(getSelfShownCount() + 1);
};

// This dismiss flag is ignored due to `ignoreDismissesBecauseExponentialBackoff: true` in original
// const getDismissed = () => localStorage.getItem(SHARE_SNACKBAR_DISMISSED_LS_KEY) === "true";
const setDismissed = () => localStorage.setItem(SHARE_SNACKBAR_DISMISSED_LS_KEY, "true");
const deleteDismissed = () => localStorage.removeItem(SHARE_SNACKBAR_DISMISSED_LS_KEY);


const customShowLogic = () => {
  const showCount = new LocalStorageInt(SHARE_SNACKBAR_SHOW_COUNTER_LS_KEY).getAndIncrement();
  if (showCount === 0) return false; // Don't show on the very first time
  if (showCount < 400) {
    return showCount % 50 === 0;
  }
  return showCount % 100 === 0;
};

export function ShareSnackbarTrigger() {
  const { showSnackbar, hideSnackbar } = useSnackbar();

  // This text selection logic was from the $(document).ready in snackbar.ts
  // It needs to be decided if this is the right component to host it.
  // For now, I'm porting it as it was shown in context of the share snackbar's text.
  const useHebrew = localStorage.languageOption === "hebrew";
  const textEnglish = [
    "Share talmud.page with a friend?",
    "Know someone who would enjoy learning here?",
    "Spread the talmud.page love!",
    "talmud.page isn't well known. Help change that?",
  ];
  const textHebrew = [
    "שתף talmud.page עם חבר/ה?",
    "מכירים מישהו שיאהב ללמוד פה?",
    "להפיץ את האהבה של talmud.page!",
    "talmud.page עוד לא מוכר. רוצה לשנות את זה?",
  ];
  // Select a random text message
  const textMessages = useHebrew ? textHebrew : textEnglish;
  const randomMessage = textMessages[Math.floor(Math.random() * textMessages.length)];


  const handleShareClick = useCallback(() => {
    const shareData: ShareData = { url: "https://talmud.page", text: randomMessage };
    if (navigator.share) {
      navigator.share(shareData)
        .then(() => {
          sendEvent({ share: true, text: randomMessage, subject: "Share action completed" });
          if (window.gtag) window.gtag("event", "snackbar.share.shared");
        })
        .catch((error) => {
          console.error("Error sharing:", error);
          sendEvent({ share: false, text: randomMessage, subject: "Share action failed" });
          if (window.gtag) window.gtag("event", "snackbar.share.shareError");
        });
    }
    // Original logic dismissed snackbar regardless of share success/failure
    setDismissed(); // Mark as "dismissed" (though it's ignored for showing, it's tracked)
    hideSnackbar(SNACKBAR_ID);
  }, [hideSnackbar, randomMessage]);

  const handleDismissClick = useCallback(() => {
    sendEvent({ share: false, text: randomMessage, subject: "Share dismissed" });
    if (window.gtag) {
      window.gtag("event", "snackbar.share.dismissed");
    }
    setDismissed();
    hideSnackbar(SNACKBAR_ID);
  }, [hideSnackbar, randomMessage]);

  useEffect(() => {
    // Logic from SnackbarManager constructor and SHARE Kind
    // const shouldReset = Kinds.SHARE.shouldResetShowCount; // Not defined for SHARE in original
    // if (shouldReset && shouldReset()) {
    //   setSelfShownCount(0);
    //   deleteDismissed(); // Though dismiss is ignored for showing, it was reset
    // }

    // `ignoreDismissesBecauseExponentialBackoff: true` means `isDismissed` is not checked for show logic.
    const currentInstanceShowCount = getSelfShownCount();

    // Check if Web Share API is available
    const canShare = navigator.canShare && navigator.canShare({ url: "https://talmud.page" });

    if (canShare && customShowLogic() && currentInstanceShowCount < MAX_SHOW_COUNT) {
      setTimeout(() => incrementSelfShownCount(), 5 * 1000);

      const snackbarConfig: SnackbarConfig = {
        id: SNACKBAR_ID,
        message: randomMessage,
        buttons: [
          {
            text: useHebrew ? "סגור" : "Dismiss",
            onClick: handleDismissClick,
          },
          {
            // Using innerHTML for icon, ensure GenericSnackbar button `text` prop supports ReactNode
            text: <i className="material-icons">share</i>,
            onClick: handleShareClick,
            className: "mdl-button--icon", // Example if specific styling is needed
          },
        ],
        kind: "share-talmud-page",
      };
      showSnackbar(snackbarConfig);
    }
  }, [showSnackbar, handleShareClick, handleDismissClick, randomMessage, useHebrew]);

  return null; // Trigger component
}
