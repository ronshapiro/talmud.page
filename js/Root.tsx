import * as React from "react";
import * as PropTypes from 'prop-types';
import {FeedbackView} from "./Feedback";
import {hebrewSearchRegex} from "../hebrew";
import {
  NextButton,
  PreviousButton,
} from "./NavigationButtons";
import {useConfiguration} from "./context";
import {Preferences} from "./Preferences";
import {Keybindings} from "./Keybindings";
import {SnackbarHost} from "./SnackbarReact";
import {Page, UiPage} from "./Page";
import {useIncrementer} from "./hooks";
import componentHandler from "./componentHandler";

const {
  useEffect,
  useState,
} = React;

interface Props {
  allAmudim: () => UiPage[];
  isFake?: boolean;
  navigationExtension: any;
  setIsReadyRef?: React.MutableRefObject<((isReady: boolean) => void)>;
  forceUpdateRef?: React.MutableRefObject<(() => void)>;
}
export function Root({
  allAmudim,
  isFake,
  navigationExtension,
  setIsReadyRef,
  forceUpdateRef,
}: Props): React.ReactElement {
  useEffect(() => {
    // Make sure mdl always registers new views correctly
    componentHandler.upgradeAllRegistered();
  });

  useEffect(() => {
    (document.getElementById("darkModeCss") as HTMLLinkElement).disabled = (
      localStorage.darkMode !== "true");
    for (const id of ["theme-color", "theme-color-dark-mode"]) {
      (document.getElementById(id) as HTMLMetaElement).content = (
        getComputedStyle(document.body).getPropertyValue('--background-color'));
    }
  });

  const context = useConfiguration();
  const [queryCount, incrementQueryCount] = useIncrementer();
  const forceUpdate = useIncrementer()[1];
  if (forceUpdateRef) forceUpdateRef.current = () => forceUpdate();
  const [isReady, setIsReady] = useState(false);
  if (setIsReadyRef) setIsReadyRef.current = () => setIsReady(true);
  const [feedbackTrigger, setFeedbackTrigger] = useState(false);

  if (!isFake && !isReady) {
    return <></>;
  }

  if (!isFake && localStorage.showFeedbackForm === "true") {
    return <FeedbackView hide={() => setFeedbackTrigger(!feedbackTrigger)} />;
  }

  const baseAmudim = allAmudim();
  const amudim = baseAmudim.map((amud, i) => (
    <Page
      key={amud.id + "-amud"}
      amudData={amud}
      navigationExtension={navigationExtension}
      firstRemovable={i === 0 && baseAmudim.length > 1}
      lastRemovable={i !== 0 && i === baseAmudim.length - 1} />));

  const updateSearchQuery = (
    color: string, query: string, asRegex: boolean | undefined) => {
    if (!context.searchQueryRegex) {
      context.searchQueryRegex = {};
    }
    context.searchQueryRegex[color] = (
      (query.length < 2) ? undefined : hebrewSearchRegex(query, !!asRegex));
    incrementQueryCount();
  };

  return (
    <>
      <div id="inner-content">
        <PreviousButton navigationExtension={navigationExtension} />
        {amudim}
        <NextButton navigationExtension={navigationExtension} />
        <Preferences rerender={() => forceUpdate()} />
      </div>
      {!isFake && (
        <>
          <SnackbarHost updateSearchQuery={updateSearchQuery} queryCount={queryCount} />
          <Keybindings />
        </>
      )}
    </>
  );
}
Root.propTypes = {
  allAmudim: PropTypes.func.isRequired,
  isFake: PropTypes.bool,
  navigationExtension: PropTypes.object.isRequired,
};
