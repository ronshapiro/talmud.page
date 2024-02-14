/* eslint-disable react/jsx-one-expression-per-line, react/jsx-closing-tag-location */
import * as React from "react";
import {v4 as newUuid} from "uuid";
import SwipeableViews from "react-swipeable-views";
import { virtualize } from "react-swipeable-views-utils";
import componentHandler from "./componentHandler";
import {useHtmlRef} from "./hooks";
import {LocalStorageInt} from "./localStorage";
import {snackbars} from "./snackbar";

const VirtualizeSwipeableViews = virtualize(SwipeableViews);
const {
  useEffect,
  useMemo,
  useState,
} = React;


interface Item {
  value: string;
  displayText: string;
}

interface PreferenceSectionParams {
  title: string | React.ReactElement;
  items: Item[];
  localStorageKeyName: string;
  rerender: () => any;
}

function PreferenceSection({
  title,
  items,
  localStorageKeyName,
  rerender,
}: PreferenceSectionParams) {
  function PreferenceItem({value, displayText}: Item) {
    const id = useMemo(newUuid, []);
    const isChecked = value === localStorage[localStorageKeyName];
    const labelRef = useHtmlRef<HTMLLabelElement>();
    const inputRef = useHtmlRef<HTMLInputElement>();
    const onChanged = () => {
      const maybeNewValue = inputRef.current!.value;
      if (maybeNewValue !== localStorage[localStorageKeyName]) {
        localStorage[localStorageKeyName] = maybeNewValue;
        rerender();
      }
    };
    useEffect(() => componentHandler.upgradeElement(labelRef.current));
    return (
      <div>
        <label className="mdl-radio mdl-js-radio mdl-js-ripple-effect" ref={labelRef} htmlFor={id}>
          <input
            ref={inputRef}
            checked={isChecked}
            onChange={() => onChanged()}
            type="radio"
            value={value}
            id={id}
            className="mdl-radio__button" />
          <span className="mdl-radio__label">{displayText}</span>
        </label>
      </div>
    );
  }

  return (
    <div style={{padding: "10px"}}>
      <span style={{display: "block", fontSize: "20px", padding: "10px 0px"}}>{title}</span>
      {items.map((item, i) => (
        <PreferenceItem value={item.value} displayText={item.displayText} key={i.toString()} />))}
    </div>
  );
}

interface PreferencesViewParams {
  rerender: () => any;
}

interface SlideRendererParams {
  index: number;
  key: any;
}

export function Preferences({rerender}: PreferencesViewParams): React.ReactElement[] {
  const options = [
    <PreferenceSection
      title="Dark Mode"
      items={[
        {value: "true", displayText: "On"},
        {value: "false", displayText: "Off"},
      ]}
      rerender={rerender}
      localStorageKeyName="darkMode" />,
    <PreferenceSection
      title="Translation"
      items={[
        {value: "english-side-by-side", displayText: "English (side-by-side)"},
        {value: "both", displayText: "English & Hebrew (expandable)"},
        {value: "just-hebrew", displayText: "Hebrew (expandable)"},
      ]}
      rerender={rerender}
      localStorageKeyName="translationOption" />,
    <PreferenceSection
      title="Layout"
      items={[
        {value: "by-segment", displayText: "Default"},
        {
          value: "compact",
          displayText: "Compact (segments of Sugyot are combined until double-tap)",
        },
      ]}
      rerender={rerender}
      localStorageKeyName="layoutOption" />,
    <PreferenceSection
      title={
        <span>
          Hide Gemara translation by default<br />
          <small>(only relevant if Translation is set to English & Hebrew (expandable)</small>
        </span>
      }
      items={[
        {value: "false", displayText: "No"},
        {value: "true", displayText: "Yes (double click the Hebrew Steinsaltz to show)"},
      ]}
      rerender={rerender}
      localStorageKeyName="hideGemaraTranslationByDefault" />,
    <PreferenceSection
      title="Wrap translations around the main text"
      items={[
        {value: "true", displayText: "Yes"},
        {value: "false", displayText: "No"},
      ]}
      rerender={rerender}
      localStorageKeyName="wrapTranslations" />,
    <PreferenceSection
      title={
        <span>
          Show Translation Button<br />
          <small>
            (translation is always available by double-clicking the &quot;Hebrew&quot;)
          </small>
        </span>
      }
      items={[
        {value: "yes", displayText: "Yes"},
        {value: "no", displayText: "No"},
      ]}
      rerender={rerender}
      localStorageKeyName="showTranslationButton" />,
    <PreferenceSection
      title={
        <span>
          Expand English translations by default<br />
          <small>
            (instead of double clicking to expand the translation when it is longer than the
            Hebrew. Requires refreshing the page.)
          </small>
        </span>
      }
      items={[
        {value: "true", displayText: "Yes"},
        {value: "false", displayText: "No"},
      ]}
      rerender={rerender}
      localStorageKeyName="expandEnglishByDefault" />,
    <PreferenceSection
      title={
        <span>Show search bar <small>(beta)</small></span>
      }
      items={[
        {value: "true", displayText: "Yes"},
        {value: "false", displayText: "No"},
      ]}
      rerender={rerender}
      localStorageKeyName="showSearchBar" />,
    <PreferenceSection
      title={
        <span>Enable offline mode<br /><small>(beta, recommended only when needed)</small></span>
      }
      items={[
        {value: "true", displayText: "Yes"},
        {value: "false", displayText: "No"},
      ]}
      rerender={rerender}
      localStorageKeyName="offlineMode" />,
  ];
  const preferencesIndex = new LocalStorageInt("preferencesIndex");
  const [currentIndex, setIndexPrivate] = useState(preferencesIndex.get() || 0);
  const setIndex = (newIndex: number) => {
    setIndexPrivate(newIndex);
    preferencesIndex.set(newIndex);
  };
  function slideRenderer({index, key}: SlideRendererParams) {
    const component = options[index % options.length];
    return <div key={key} style={{display: "flex"}}>
      <button
        className="mdl-button mdl-js-button mdl-button--icon mdl-button"
        onClick={() => setIndex(index === 0 ? options.length - 1 : index - 1)}>
        <i className="material-icons">chevron_left</i>
      </button>
      <div style={{flexGrow: 1}}>
        {component}
      </div>
      <button
        className="mdl-button mdl-js-button mdl-button--icon mdl-button"
        onClick={() => setIndex(index + 1)}>
        <i className="material-icons">chevron_right</i>
      </button>
    </div>;
  }

  const [show, setShowing] = useState(false);
  (window as any).showPreferences = () => setShowing(true);
  const elements = [
    <button
      id="showSettings"
      key="showSettings"
      className="mdl-button mdl-js-button mdl-button--icon"
      onClick={() => setShowing(x => !x)}>
      <i className="material-icons">settings</i>
    </button>,
  ];
  if (show) {
    snackbars.preferencesNudge.dismissButtonImpl();
    elements.push(
      <div id="preferences-container" key="preferences-container">
        <VirtualizeSwipeableViews
          slideRenderer={slideRenderer}
          index={currentIndex}
          onChangeIndex={setIndex}
          animateHeight />
      </div>,
    );
  }
  return elements;
}
