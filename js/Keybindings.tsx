import * as Mousetrap from "mousetrap";
import * as React from "react";
import {useConfiguration} from "./context";
import {Scrolling, useScrollTo} from "./useScrollTo";
import {$} from "./jquery";

const {
  useEffect,
} = React;

function effectCacheKeys(scrolling: Scrolling): any[] {
  return [scrolling.currentMatch, scrolling.currentMatchedView, scrolling.matches];
}

export function Keybindings(): React.ReactElement {
  const context = useConfiguration();

  const rowScrolling = useScrollTo("#results .table-row", {speed: 100});
  const {currentMatch, currentMatchedView, matches, scrollToDiffedIndex} = rowScrolling;
  let buttonQuery = currentMatchedView?.id;
  if (!buttonQuery || buttonQuery === "") buttonQuery = "devNull";
  const buttonsScrolling = useScrollTo(`#${buttonQuery} .commentary_header`);

  const switchRow = (diff: number, condition: boolean) => {
    if (condition) {
      buttonsScrolling.clearState();
      scrollToDiffedIndex(diff);
      context.forceFullUpdate();
    }
  };

  const switchButton = (diff: number) => {
    if (buttonsScrolling.matches > 0) {
      buttonsScrolling.scrollToDiffedIndex(diff);
      context.forceFullUpdate();
    }
  };
  let bindings: Record<string, any> = {
    /* eslint-disable quote-props */
    // TODO: if there's no selected row, use what's on screen? Or have some way to change the
    // position with the mouse?
    "j": () => switchRow(1, !currentMatch || currentMatch + 1 !== matches),
    "k": () => switchRow(-1, (currentMatch ?? 0) > 0),
    // TODO: these need to adapt to the translation settings
    "e n": () => $(currentMatchedView).find(".english").trigger("betterDoubleClick"),
    "s t": () => $(currentMatchedView).find(".hebrew").trigger("betterDoubleClick"),
    "n": () => switchButton(1),
    "p": () => switchButton(-1),
    "o": () => {
      if (buttonsScrolling.matches > 0) {
        buttonsScrolling.currentMatchedView?.click();
        /*
        const newButton = $("#" + buttonsScrolling.currentMatchedView.id + ".commentary_header")[0];
        const newRow = $(newButton).parents(".table-row")[0];
        adjuster(newRow);
        */
        context.forceFullUpdate();
      }
    },
    /* eslint-enable quote-props */
  };
  if (localStorage.keyboardShortcuts !== "true") {
    bindings = {};
  }

  const cachingKeys = (
    [localStorage.keyboardShortcuts]
      .concat(effectCacheKeys(rowScrolling))
      .concat(effectCacheKeys(buttonsScrolling)));

  useEffect(() => {
    // TODO: can these leak the views?
    context.selectedView = currentMatchedView;
    context.selectedCommentaryView = buttonsScrolling.currentMatchedView;

    for (const [key, binding] of Object.entries(bindings)) {
      Mousetrap.bind(key, binding);
    }
    return () => {
      for (const key of Object.keys(bindings)) {
        Mousetrap.unbind(key);
      }
    };
  }, cachingKeys);

  return <></>;
}
