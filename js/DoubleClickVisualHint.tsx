import * as React from "react";
import * as PropTypes from "prop-types";

export const DoubleClickHintSurfaceType = {
  STEINSALTZ: "steinsaltz",
  RASHI_EXPLANATION: "rashi_explanation",
} as const;

export type DoubleClickHintSurfaceType =
  typeof DoubleClickHintSurfaceType[keyof typeof DoubleClickHintSurfaceType] | string;

export const ONE_MONTH_IN_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;
export const VISUAL_HINT_INITIAL_DELAY_MILLISECONDS = 1000;
export const VISUAL_HINT_PULSE_DURATION_MILLISECONDS = 650;
export const VISUAL_HINT_PAUSE_DURATION_MILLISECONDS = 2200;
export const VISUAL_HINT_PULSE_CYCLE_COUNT = 3;

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
  return true;
}

export function recordDoubleClickVisualHintDisplayed(
  surfaceType: DoubleClickHintSurfaceType,
  currentTimestamp: number = Date.now(),
): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }
  window.localStorage.setItem(
    getLastDisplayedStorageKey(surfaceType),
    currentTimestamp.toString(),
  );
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

export interface DoubleClickVisualHintProps {
  surfaceType: DoubleClickHintSurfaceType;
  onFinished?: () => void;
  pulseCycleCount?: number;
  initialDelayMilliseconds?: number;
  pulseDurationMilliseconds?: number;
  pauseDurationMilliseconds?: number;
}

export function DoubleClickVisualHint({
  surfaceType,
  onFinished,
  pulseCycleCount = VISUAL_HINT_PULSE_CYCLE_COUNT,
  initialDelayMilliseconds = VISUAL_HINT_INITIAL_DELAY_MILLISECONDS,
  pulseDurationMilliseconds = VISUAL_HINT_PULSE_DURATION_MILLISECONDS,
  pauseDurationMilliseconds = VISUAL_HINT_PAUSE_DURATION_MILLISECONDS,
}: DoubleClickVisualHintProps): React.ReactElement | null {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isVisibleOnScreen, setIsVisibleOnScreen] = React.useState(false);
  const [currentCycle, setCurrentCycle] = React.useState(0);
  const [isPulsating, setIsPulsating] = React.useState(false);
  const [isFinished, setIsFinished] = React.useState(false);

  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      setIsVisibleOnScreen(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setIsVisibleOnScreen(true);
          observer.disconnect();
          break;
        }
      }
    }, {threshold: 0.1});

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => {
      observer.disconnect();
    };
  }, []);

  React.useEffect(() => {
    if (!isVisibleOnScreen || currentCycle > 0 || isFinished) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setCurrentCycle(1);
      setIsPulsating(true);
    }, initialDelayMilliseconds);

    return () => {
      clearTimeout(timer);
    };
  }, [isVisibleOnScreen, currentCycle, isFinished, initialDelayMilliseconds]);

  React.useEffect(() => {
    if (currentCycle === 0 || isFinished) {
      return undefined;
    }

    if (isPulsating) {
      const timer = setTimeout(() => {
        setIsPulsating(false);
      }, pulseDurationMilliseconds);
      return () => {
        clearTimeout(timer);
      };
    }

    const timer = setTimeout(() => {
      if (currentCycle < pulseCycleCount) {
        setCurrentCycle(previousCycle => previousCycle + 1);
        setIsPulsating(true);
      } else {
        recordDoubleClickVisualHintDisplayed(surfaceType);
        setIsFinished(true);
        onFinished?.();
      }
    }, pauseDurationMilliseconds);

    return () => {
      clearTimeout(timer);
    };
  }, [
    currentCycle,
    isPulsating,
    isFinished,
    pulseCycleCount,
    pulseDurationMilliseconds,
    pauseDurationMilliseconds,
    surfaceType,
    onFinished,
  ]);

  if (isFinished) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={`double-click-hint-overlay ${isPulsating ? "is-pulsating" : ""}`}
      data-surface-type={surfaceType}
      data-cycle={currentCycle}
      title="Double click to open"
      aria-label="Double click to open"
      role="img"
    >
      <div key={currentCycle} className="double-click-hint-dot">
        <span className="double-click-hint-core" />
        <span className="double-click-hint-ripple" />
      </div>
    </div>
  );
}

DoubleClickVisualHint.propTypes = {
  surfaceType: PropTypes.string.isRequired,
  onFinished: PropTypes.func,
  pulseCycleCount: PropTypes.number,
  initialDelayMilliseconds: PropTypes.number,
  pulseDurationMilliseconds: PropTypes.number,
  pauseDurationMilliseconds: PropTypes.number,
};
