import {rsiReviewKeyPreference} from "./settings";

let checkedUrlForKey = false;

/**
 * Picks up a one-time `?rsiReviewKey=<secret>` URL param (the only way this key is ever
 * distributed — there's no login flow to grant it through), persists it to localStorage via
 * rsiReviewKeyPreference, and strips it from the visible URL so it isn't left in a link a reviewer
 * might share. Idempotent and safe to call more than once — getRsiReviewKey() below calls this
 * itself, so nothing depends on call order at page-load time.
 */
export function initializeRsiReviewKey(): void {
  if (checkedUrlForKey) return;
  checkedUrlForKey = true;

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
  initializeRsiReviewKey();
  return rsiReviewKeyPreference.get();
}

/** Test-only: lets a test simulate a fresh page load's not-yet-checked-the-URL state. */
export function resetRsiReviewKeyInitializationForTesting(): void {
  checkedUrlForKey = false;
}
