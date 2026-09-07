import {rsiReviewKeyPreference} from "./settings";

/**
 * Picks up a one-time `?rsiReviewKey=<secret>` URL param (the only way this key is ever
 * distributed — there's no login flow to grant it through), persists it to localStorage via
 * rsiReviewKeyPreference, and strips it from the visible URL so it isn't left in a link a reviewer
 * might share. Call once at page-load time, matching initializeLocalStorage.ts's convention.
 */
export function initializeRsiReviewKey(): void {
  const params = new URLSearchParams(window.location.search);
  const key = params.get("rsiReviewKey");
  if (!key) return;

  rsiReviewKeyPreference.set(key);

  params.delete("rsiReviewKey");
  const newSearch = params.toString();
  const newUrl = window.location.pathname
    + (newSearch ? `?${newSearch}` : "")
    + window.location.hash;
  window.history.replaceState(undefined, "", newUrl);
}

/** Present only for the one reviewer who has visited a `?rsiReviewKey=` link. */
export function getRsiReviewKey(): string | undefined {
  return rsiReviewKeyPreference.get();
}
