import * as React from "react";
import {$} from "./jquery";
import {useArrayStateBackedByLength} from "./state";

const {
  useEffect,
  useMemo,
  useState,
} = React;

const CURRENT_MATCH_UNSET = Number.MIN_SAFE_INTEGER;
function computeNextMatchIndex(currentIndex: number, diff: number, maxIndex: number): number {
  if (currentIndex === CURRENT_MATCH_UNSET) {
    return diff === 1 ? 0 : maxIndex - 1;
  }
  const newIndex = currentIndex + diff;
  if (newIndex < 0) {
    return maxIndex - 1;
  } else if (newIndex === maxIndex) {
    return 0;
  }
  return newIndex;
}

export interface Scrolling {
  currentMatch: number | undefined;
  currentMatchedView: HTMLElement | undefined;
  matches: number,
  clearState: () => void;
  scrollToDiffedIndex: (diff: number) => void;
}

interface Options {
  speed?: number;
}

function* iterateOutwards<T>(array: T[], index: number): Generator<T> {
  const maxDelta = Math.max(
    Math.abs(array.length - index),
    Math.abs(index - array.length));
  if (maxDelta > 100_000) {
    throw new Error(maxDelta.toString());
  }

  for (let delta = 1; delta < maxDelta; delta++) {
    const candidates = [array[index - delta], array[index + delta]];
    for (const candidate of candidates) {
      if (candidate) {
        yield candidate;
      }
    }
  }
}

export function useScrollTo(jqueryQuery: string, options?: Options): Scrolling {
  const [currentMatch, setCurrentMatch] = useState(CURRENT_MATCH_UNSET);
  const [currentMatchedView, setCurrentMatchedView] = useState(undefined);

  const [matches, setMatches] = useArrayStateBackedByLength([]);
  const [lastMatches, setLastMatches] = useArrayStateBackedByLength([]);

  const clearState = () => {
    setCurrentMatch(CURRENT_MATCH_UNSET);
    setCurrentMatchedView(undefined);
  };

  useEffect(() => {
    setMatches(Array.from($(jqueryQuery)));
    setLastMatches(matches);
  });

  useMemo(() => {
    if (currentMatchedView) {
      let newIndex = matches.indexOf(currentMatchedView);
      if (newIndex === -1) {
        const matchesSet = new Set(matches);
        for (const candidate of iterateOutwards(lastMatches, currentMatch)) {
          if (matchesSet.has(candidate)) {
            newIndex = matches.indexOf(candidate);
            break;
          }
        }
      }
      setCurrentMatch(newIndex === -1 ? CURRENT_MATCH_UNSET : newIndex);
    }
  }, [matches.length]);

  const scrollToDiffedIndex = (diff: number) => {
    const newIndex = computeNextMatchIndex(currentMatch, diff, matches.length);
    setCurrentMatch(newIndex);
    const newMatchedView = matches[newIndex];
    setCurrentMatchedView(newMatchedView);
    if (!$(newMatchedView).isInViewport()) {
      const viewportTop = $(window).scrollTop();
      const viewportBottom = viewportTop + $(window).height();
      const viewportHeight = (viewportBottom - viewportTop);
      $("html, body").animate({
        scrollTop: $(newMatchedView).offset().top - viewportHeight / 4,
      }, options?.speed ?? 0);
    }
  };

  /*
  // Fix: any typing, and name
  const adjuster = (element: any) => {
    console.log("adjuster!", element.id);
    const newMatches = Array.from($(jqueryQuery))
    setMatches(newMatches);
    setLastMatches(matches);
    for (let i = 0; i < newMatches.length; i++) {
      console.log(newMatches[i].id);
      if (newMatches[i].id === element.id) {
        console.log("!!!!!", i);
        setCurrentMatch(i);
        setCurrentMatchedView(newMatches[i]);
      }
    }
  };
  */

  return {
    currentMatch: currentMatch === CURRENT_MATCH_UNSET ? undefined : currentMatch,
    currentMatchedView,
    matches: matches.length,
    clearState,
    scrollToDiffedIndex,
    // adjuster,
  };
}
