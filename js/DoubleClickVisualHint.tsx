import * as React from "react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as PropTypes from "prop-types";
import {useConfiguration} from "./context";
import {LocalStorageInt} from "./localStorage";

export const DoubleClickHintSurfaceType = {
  STEINSALTZ: "steinsaltz",
  RASHI_EXPLANATION: "rashi_explanation",
} as const;

export type DoubleClickHintSurfaceType =
  typeof DoubleClickHintSurfaceType[keyof typeof DoubleClickHintSurfaceType] | string;

export const ONE_MONTH_IN_MILLISECONDS = 30 * 24 * 60 * 60 * 1000;
export const VISUAL_HINT_INITIAL_DELAY_MILLISECONDS = 1000;
export const VISUAL_HINT_PULSE_DURATION_MILLISECONDS = 950;
export const VISUAL_HINT_PAUSE_DURATION_MILLISECONDS = 2000;
export const VISUAL_HINT_PULSE_CYCLE_COUNT = 3;

function getLastDoubleTapStorage(surfaceType: string): LocalStorageInt {
  return new LocalStorageInt(`doubleClickHint.lastDoubleTap.${surfaceType}`);
}

function getLastDisplayedStorage(surfaceType: string): LocalStorageInt {
  return new LocalStorageInt(`doubleClickHint.lastDisplayed.${surfaceType}`);
}

const claimedHintsInCurrentSession = new Set<string>();

export function shouldDisplayDoubleClickVisualHint(
  surfaceType: DoubleClickHintSurfaceType,
  currentTimestamp: number = Date.now(),
): boolean {
  if (!window?.localStorage) {
    return false;
  }

  if (claimedHintsInCurrentSession.has(surfaceType)) {
    return false;
  }

  const lastDoubleTapTimestamp = getLastDoubleTapStorage(surfaceType).get();
  if (lastDoubleTapTimestamp !== undefined) {
    const elapsedSinceLastDoubleTap = currentTimestamp - lastDoubleTapTimestamp;
    if (elapsedSinceLastDoubleTap >= 0 && elapsedSinceLastDoubleTap < ONE_MONTH_IN_MILLISECONDS) {
      return false;
    }
  }

  const lastDisplayedTimestamp = getLastDisplayedStorage(surfaceType).get();
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
  if (shouldDisplayDoubleClickVisualHint(surfaceType, currentTimestamp)) {
    claimedHintsInCurrentSession.add(surfaceType);
    return true;
  }
  return false;
}

export function recordDoubleClickVisualHintDisplayed(
  surfaceType: DoubleClickHintSurfaceType,
  currentTimestamp: number = Date.now(),
): void {
  if (!window?.localStorage) {
    return;
  }
  getLastDisplayedStorage(surfaceType).set(currentTimestamp);
}

export function recordDoubleClickInteraction(
  surfaceType: DoubleClickHintSurfaceType,
  currentTimestamp: number = Date.now(),
): void {
  if (!window?.localStorage) {
    return;
  }
  getLastDoubleTapStorage(surfaceType).set(currentTimestamp);
  window.dispatchEvent(
    new CustomEvent("doubleClickInteraction", {
      detail: {surfaceType},
    }),
  );
}

export function resetDoubleClickVisualHintState(): void {
  claimedHintsInCurrentSession.clear();
  if (window?.localStorage) {
    for (const surfaceType of Object.values(DoubleClickHintSurfaceType)) {
      window.localStorage.removeItem(`doubleClickHint.lastDoubleTap.${surfaceType}`);
      window.localStorage.removeItem(`doubleClickHint.lastDisplayed.${surfaceType}`);
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisibleOnScreen, setIsVisibleOnScreen] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(0);
  const [isPulsating, setIsPulsating] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
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

  useEffect(() => {
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

  useEffect(() => {
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
        <span className="double-click-hint-ripple ripple-first" />
        <span className="double-click-hint-ripple ripple-second" />
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

export interface UseDoubleClickVisualHintResult {
  visualIndicator: React.ReactElement | null;
  doubleClickListener?: () => void;
  isVisualHintActive: boolean;
}

export function useDoubleClickVisualHint(
  surfaceType?: DoubleClickHintSurfaceType,
  doubleClickListener?: () => void,
): UseDoubleClickVisualHintResult {
  const configuration = useConfiguration();

  const effectiveSurfaceType = doubleClickListener ? surfaceType : undefined;

  const [isVisualHintActive, setIsVisualHintActive] = useState(() => {
    if (configuration.isFake || !effectiveSurfaceType) {
      return false;
    }
    return claimDoubleClickVisualHint(effectiveSurfaceType);
  });

  useEffect(() => {
    if (!effectiveSurfaceType || !isVisualHintActive) {
      return undefined;
    }
    const handleInteraction = (event: Event) => {
      const customEvent = event as CustomEvent<{surfaceType: string}>;
      if (customEvent.detail?.surfaceType === effectiveSurfaceType) {
        setIsVisualHintActive(false);
      }
    };
    window.addEventListener("doubleClickInteraction", handleInteraction);
    return () => {
      window.removeEventListener("doubleClickInteraction", handleInteraction);
    };
  }, [effectiveSurfaceType, isVisualHintActive]);

  const wrappedDoubleClickListener = useMemo(() => {
    if (!doubleClickListener && !effectiveSurfaceType) {
      return undefined;
    }
    return () => {
      if (effectiveSurfaceType) {
        recordDoubleClickInteraction(effectiveSurfaceType);
        setIsVisualHintActive(false);
      }
      doubleClickListener?.();
    };
  }, [doubleClickListener, effectiveSurfaceType]);

  const visualIndicator = isVisualHintActive && effectiveSurfaceType ? (
    <DoubleClickVisualHint
      surfaceType={effectiveSurfaceType}
      onFinished={() => setIsVisualHintActive(false)}
    />
  ) : null;

  return {
    visualIndicator,
    doubleClickListener: wrappedDoubleClickListener,
    isVisualHintActive,
  };
}

export const useDoubleClickVisualIndicator = useDoubleClickVisualHint;
