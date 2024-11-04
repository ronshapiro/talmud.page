import * as Mousetrap from "mousetrap";
import * as React from "react";
import {useScrollTo} from "./useScrollTo";

const {
  useEffect,
} = React;

export function Keybindings(): React.ReactElement {
  const scrolling = useScrollTo(".table-row");
  useEffect(() => {
    let bindings = {
      j: () => {
        if (!scrolling.currentMatch || scrolling.currentMatch + 1 !== scrolling.matches) {
          scrolling.scrollToDiffedIndex(1);
        }
      },
      k: () => {
        if (scrolling.currentMatch && scrolling.currentMatch !== 0) {
          scrolling.scrollToDiffedIndex(-1);
        }
      },
    };
    bindings = ({} as any);
    for (const [key, binding] of Object.entries(bindings)) {
      Mousetrap.bind(key, binding);
    }
    return () => {
      for (const key of Object.keys(bindings)) {
        Mousetrap.unbind(key);
      }
    };
  }, [scrolling.currentMatch, scrolling.matches]);

  return <></>;
}
