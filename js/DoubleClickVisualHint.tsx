import * as React from "react";
import * as PropTypes from "prop-types";

export const DoubleClickHintSurfaceType = {
  STEINSALTZ: "steinsaltz",
  RASHI_EXPLANATION: "rashi_explanation",
} as const;

export type DoubleClickHintSurfaceType =
  typeof DoubleClickHintSurfaceType[keyof typeof DoubleClickHintSurfaceType] | string;

export const ONE_MONTH_IN_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;

function getLastDoubleTapStorageKey(surfaceType: string): string {
  return `doubleClickHint.lastDoubleTap.${surfaceType}`;
}

function getLastDisplayedStorageKey(surfaceType: string): string {
  return `doubleClickHint.lastDisplayed.${surfaceType}`;
}

function readStoredTimestamp(storageKey: string): number | undefined {
  if (typeof window === "undefined" || !window.localStorage) {
    return undefined;
  }
  const storedValue = window.localStorage.getItem(storageKey);
  if (!storedValue) {
    return undefined;
  }
  const parsedTimestamp = parseInt(storedValue, 10);
  return Number.isNaN(parsedTimestamp) ? undefined : parsedTimestamp;
}

const claimedHintsInCurrentSession = new Set<string>();

export function shouldDisplayDoubleClickVisualHint(
  surfaceType: DoubleClickHintSurfaceType,
  currentTimestamp: number = Date.now(),
): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }

  if (claimedHintsInCurrentSession.has(surfaceType)) {
    return false;
  }

  const lastDoubleTapTimestamp = readStoredTimestamp(getLastDoubleTapStorageKey(surfaceType));
  if (lastDoubleTapTimestamp !== undefined) {
    const elapsedSinceLastDoubleTap = currentTimestamp - lastDoubleTapTimestamp;
    if (elapsedSinceLastDoubleTap >= 0 && elapsedSinceLastDoubleTap < ONE_MONTH_IN_MILLISECONDS) {
      return false;
    }
  }

  const lastDisplayedTimestamp = readStoredTimestamp(getLastDisplayedStorageKey(surfaceType));
  if (lastDisplayedTimestamp !== undefined) {
    const elapsedSinceLastDisplayed = currentTimestamp - lastDisplayedTimestamp;
    if (elapsedSinceLastDisplayed >= 0 && elapsedSinceLastDisplayed < ONE_MONTH_IN_MILLISECONDS) {
      return false;
    }
  }

  return true;
}

export function claimDoubleClickVisualHint(
  surfaceType: DoubleClickHintSurfaceType,
  currentTimestamp: number = Date.now(),
): boolean {
  if (!shouldDisplayDoubleClickVisualHint(surfaceType, currentTimestamp)) {
    return false;
  }
  claimedHintsInCurrentSession.add(surfaceType);
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem(
      getLastDisplayedStorageKey(surfaceType),
      currentTimestamp.toString(),
    );
  }
  return true;
}

export function recordDoubleClickInteraction(
  surfaceType: DoubleClickHintSurfaceType,
  currentTimestamp: number = Date.now(),
): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(
    getLastDoubleTapStorageKey(surfaceType),
    currentTimestamp.toString(),
  );
  window.dispatchEvent(
    new CustomEvent("doubleClickInteraction", {
      detail: {surfaceType},
    }),
  );
}

export function resetDoubleClickVisualHintState(): void {
  claimedHintsInCurrentSession.clear();
  if (typeof window !== "undefined" && window.localStorage) {
    for (const surfaceType of Object.values(DoubleClickHintSurfaceType)) {
      window.localStorage.removeItem(getLastDoubleTapStorageKey(surfaceType));
      window.localStorage.removeItem(getLastDisplayedStorageKey(surfaceType));
    }
  }
}

interface DoubleClickVisualHintProps {
  surfaceType: DoubleClickHintSurfaceType;
}

export function DoubleClickVisualHint({
  surfaceType,
}: DoubleClickVisualHintProps): React.ReactElement {
  return (
    <span
      className="double-click-hint-container"
      data-surface-type={surfaceType}
      title="Double click to open"
      aria-label="Double click to open"
      role="img"
    >
      <span className="double-click-hint-dot">
        <span className="double-click-hint-core" />
        <span className="double-click-hint-ripple" />
      </span>
    </span>
  );
}

DoubleClickVisualHint.propTypes = {
  surfaceType: PropTypes.string.isRequired,
};
