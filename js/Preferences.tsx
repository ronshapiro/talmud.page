/* eslint-disable react/jsx-one-expression-per-line, react/jsx-closing-tag-location */
import * as React from "react";
import {v4 as newUuid} from "uuid";
import SwipeableViews from "react-swipeable-views";
import { virtualize } from "react-swipeable-views-utils";
import {upgradeElement} from "./componentHandler";
import {useHtmlRef, useUpdateDarkMode, useIncrementer} from "./hooks";
import {LocalStorageInt} from "./localStorage";
import {snackbars} from "./snackbar";
import {useConfiguration} from "./context";
import {getCustomThemes, deleteCustomTheme, CustomTheme} from "./CustomThemes";
import {ThemeEditor} from "./ThemeEditor";

const VirtualizeSwipeableViews = virtualize(SwipeableViews);
const {
  useEffect,
  useMemo,
  useState,
} = React;


interface Item {
  value: string;
  displayText: string;
  displayTextHebrew: string;
}

interface PreferenceSectionParams {
  title: string | React.ReactElement;
  titleHebrew: string | React.ReactElement;
  items: Item[];
  localStorageKeyName: string;
  rerender: () => any;
  ignoreInHebrew?: true;
}

function useHebrew() {
  return localStorage.languageOption === "hebrew";
}

function PreferenceSection({
  title,
  titleHebrew,
  items,
  localStorageKeyName,
  rerender,
}: PreferenceSectionParams) {
  function PreferenceItem({item}: {item: Item}) {
    const {value, displayText, displayTextHebrew} = item;
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
    useEffect(() => upgradeElement(labelRef.current));
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
          <span className="mdl-radio__label">{useHebrew() ? displayTextHebrew : displayText}</span>
        </label>
      </div>
    );
  }

  return (
    <div style={{padding: "10px"}}>
      <span style={{display: "block", fontSize: "20px", padding: "10px 0px"}}>
        {useHebrew() ? titleHebrew : title}
      </span>
      {items.map((item, i) => (<PreferenceItem item={item} key={i.toString()} />))}
    </div>
  );
}

interface RerenderViewParams {
  rerender: () => any;
}

interface SlideRendererParams {
  index: number;
  key: any;
}

function copyEnglishText(item: Omit<Item, "displayTextHebrew">): Item {
  return {...item, displayTextHebrew: item.displayText};
}

const STANDARD_YES_TRUE_NO_FALSE = [
  {value: "true", displayText: "Yes", displayTextHebrew: "כן"},
  {value: "false", displayText: "No", displayTextHebrew: "לא"},
];

export type Version = {hebrew: string, english: string};

function defaultVersion(versionStorageKey: string): Item {
  if (versionStorageKey === "Talmud") {
    return {
      value: "default",
      displayText: "Punctuated and Vocalized by Sefaria (Default)",
      displayTextHebrew: "מנוקד על ידי ספריא (ברירת מחדל)",
    };
  }
  if (versionStorageKey === "Tanakh") {
    return {
      value: "default",
      displayText: "Vocalized with Trope (Default)",
      displayTextHebrew: "מנוקד עם טעמי המקרא (ברירת מחדל)",
    };
  }

  return {
    value: "default",
    displayText: "Default",
    displayTextHebrew: "ברירת מחדל",
  };
}

function preferenceOptions(
  rerender: () => any,
  versions: Version[],
  versionStorageKey: string,
  openThemeEditor: (theme?: CustomTheme) => void,
): React.ReactElement[] {
  const customThemes = getCustomThemes();
  const displayItems: Item[] = [
    {value: "true", displayText: "Dark Mode", displayTextHebrew: "כהה"},
    {value: "gray", displayText: "Gray Mode", displayTextHebrew: "אפור"},
    {value: "false", displayText: "Light Mode", displayTextHebrew: "בהיר"},
  ];

  for (const theme of customThemes) {
    displayItems.push({
      value: theme.name,
      displayText: theme.name,
      displayTextHebrew: theme.name,
    });
  }

  const allOptions = [
    // Note: It's important that this is the first option so that there are no ignoreInHebrew
    // options before it. Otherwise, the swipe index could get mangled when switching languages.
    // See also resetOtherLanguageIndex(). It's also used in displayLanguageOption
    <PreferenceSection
      title="Display Language // שפת האתר"
      titleHebrew="שפת האתר // Display Language"
      items={[
        copyEnglishText({value: "hebrew", displayText: "עברית (לא  רוצה אנגלית אף פעם)"}),
        copyEnglishText(
          {value: "mix", displayText: "Mix: I can do Hebrew, but sometimes want English"}),
        copyEnglishText({value: "english", displayText: "English"}),
      ]}
      rerender={rerender}
      localStorageKeyName="languageOption" />,
    <PreferenceSection
      title="Translation"
      titleHebrew=""
      ignoreInHebrew
      items={[
        copyEnglishText({value: "english-side-by-side", displayText: "English (side-by-side)"}),
        copyEnglishText({value: "both", displayText: "English & Hebrew (expandable)"}),
        copyEnglishText({value: "just-hebrew", displayText: "Hebrew (expandable)"}),
      ]}
      rerender={rerender}
      localStorageKeyName="translationOption" />,
    <PreferenceSection
      title="Layout"
      titleHebrew="פריסת הטקסט"
      items={[
        {value: "by-segment", displayText: "Default", displayTextHebrew: "ברירת מחדל"},
        {
          value: "compact",
          displayText: "Compact (segments of Sugyot are combined until double-tap)",
          displayTextHebrew: "קומפקטי: (משפטים בסוגיות מאוחדות עד לחיצה כפולה)",
        },
      ]}
      rerender={rerender}
      localStorageKeyName="layoutOption" />,
    <PreferenceSection
      title="Display"
      titleHebrew="תצוגה"
      items={displayItems}
      rerender={rerender}
      localStorageKeyName="darkMode" />,
    <div style={{padding: "10px"}}>
      <button
        className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect"
        onClick={() => openThemeEditor()}>
        Create New Theme
      </button>
      {customThemes.length > 0 && (
        <div style={{marginTop: "10px"}}>
          <div style={{fontSize: "16px", marginBottom: "5px"}}>Manage Custom Themes:</div>
          {customThemes.map(theme => (
            <div key={theme.name} style={{display: "flex", alignItems: "center", marginBottom: "5px"}}>
              <span style={{flexGrow: 1}}>{theme.name}</span>
              <button
                className="mdl-button mdl-js-button mdl-button--icon"
                onClick={() => openThemeEditor(theme)}>
                <i className="material-icons">edit</i>
              </button>
              <button
                className="mdl-button mdl-js-button mdl-button--icon"
                onClick={() => {
                  if (window.confirm(`Delete theme "${theme.name}"?`)) {
                    deleteCustomTheme(theme.name);
                    rerender();
                  }
                }}>
                <i className="material-icons">delete</i>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>,
    <PreferenceSection
      ignoreInHebrew
      title={
        <span>
          Hide Gemara translation by default <br />
          <small>(only relevant if Translation is set to English & Hebrew (expandable))</small>
        </span>
      }
      titleHebrew=""
      items={[
        copyEnglishText({value: "false", displayText: "No"}),
        copyEnglishText({value: "true", displayText: "Yes (double click the Hebrew Steinsaltz to show)"}),
      ]}
      rerender={rerender}
      localStorageKeyName="hideGemaraTranslationByDefault" />,
    <PreferenceSection
      ignoreInHebrew
      title="Wrap translations around the main text"
      titleHebrew=""
      items={STANDARD_YES_TRUE_NO_FALSE}
      rerender={rerender}
      localStorageKeyName="wrapTranslations" />,
    <PreferenceSection
      ignoreInHebrew
      title={
        <span>
          Show Translation Button<br />
          <small>
            (translation is always available by double-clicking the &quot;Hebrew&quot;)
          </small>
        </span>
      }
      titleHebrew=""
      items={[
        copyEnglishText({value: "yes", displayText: "Yes"}),
        copyEnglishText({value: "no", displayText: "No"}),
      ]}
      rerender={rerender}
      localStorageKeyName="showTranslationButton" />,
    <PreferenceSection
      ignoreInHebrew
      title={
        <span>
          Expand English translations by default<br />
          <small>
            (instead of double clicking to expand the translation when it is longer than the
            Hebrew. Requires refreshing the page.)
          </small>
        </span>
      }
      titleHebrew=""
      items={STANDARD_YES_TRUE_NO_FALSE}
      rerender={rerender}
      localStorageKeyName="expandEnglishByDefault" />,
    <PreferenceSection
      title="Show page metadata"
      titleHebrew="הצג מטא דאטה לפי דף"
      items={STANDARD_YES_TRUE_NO_FALSE}
      rerender={rerender}
      localStorageKeyName="showPageMetadata" />,
    <PreferenceSection
      title={
        <span>Enable offline mode<br /><small>(beta, recommended only when needed)</small></span>
      }
      titleHebrew={
        <span>אפשר מצב אופליין<br /><small>(בטא, מומלץ רק במידת הצורך)</small></span>
      }
      items={STANDARD_YES_TRUE_NO_FALSE}
      rerender={rerender}
      localStorageKeyName="offlineMode" />,
    <PreferenceSection
      title={
        <span>Enable keyboard shortcuts mode<br /><small>(beta)</small></span>
      }
      titleHebrew={
        <span>אפשר קיצורי מקלדת<br /><small>(בטא)</small></span>
      }
      items={STANDARD_YES_TRUE_NO_FALSE}
      rerender={rerender}
      localStorageKeyName="keyboardShortcuts" />,
    <PreferenceSection
      title={
        <span>Debug selection bugs<br /><small>(aah!)</small></span>
      }
      titleHebrew={
        <span>Debug selection bugs<br /><small>(aah!)</small></span>
      }
      items={STANDARD_YES_TRUE_NO_FALSE}
      rerender={rerender}
      localStorageKeyName="debugSelection" />,
  ];
  if (window.location.host.startsWith("localhost")) {
    allOptions.push(
      <PreferenceSection
        title="Disable client-side API caching"
        titleHebrew="Disable client-side API caching"
        items={STANDARD_YES_TRUE_NO_FALSE}
        rerender={rerender}
        localStorageKeyName="ignoreLocalCache" />,
      <PreferenceSection
        title="Disable next/previous page precaching"
        titleHebrew="Disable next/previous page precaching"
        items={STANDARD_YES_TRUE_NO_FALSE}
        rerender={rerender}
        localStorageKeyName="disablePrecaching" />,
    );
  }

  if (versions && versions.length > 0) {
    const versionItems = versions.map(version => {
      return {
        value: version.english,
        displayText: version.english,
        displayTextHebrew: version.hebrew,
      };
    });

    versionItems.unshift(defaultVersion(versionStorageKey));
    allOptions.splice(
      2, 0,
      <PreferenceSection
        title="Preferred Version"
        titleHebrew="גרסה מעודפת"
        items={versionItems}
        rerender={rerender}
        localStorageKeyName={`preferredVersion_${versionStorageKey}`} />,
      <PreferenceSection
        title="Show alternate versions"
        titleHebrew="הצג גרסאות אחרות"
        items={STANDARD_YES_TRUE_NO_FALSE}
        rerender={rerender}
        localStorageKeyName="showAlternateVersions" />,
    );
  }
  return useHebrew()
    ? allOptions.filter(option => !option.props.ignoreInHebrew)
    : allOptions;
}

export function Preferences({rerender: originalRerender}: RerenderViewParams): React.ReactElement {
  const [rerenderCounter, rerender] = useIncrementer();
  const combinedRerender = () => {
    rerender();
    originalRerender();
  };
  const context = useConfiguration();
  const [editingTheme, setEditingTheme] = useState<CustomTheme | undefined | null>(null);

  const options = preferenceOptions(
    combinedRerender,
    context.versions ? context.versions() : [],
    context.rendererType,
    (theme) => setEditingTheme(theme || undefined));

  useUpdateDarkMode();

  const preferencesIndex = new LocalStorageInt("preferencesIndex");
  const englishIndexState = useState(preferencesIndex.get() || 0);
  const hebrewIndexState = useState(preferencesIndex.get() || 0);
  const [currentIndex, setIndexPrivate] = useHebrew() ? hebrewIndexState : englishIndexState;
  const resetOtherLanguageIndex = () => (useHebrew() ? englishIndexState : hebrewIndexState)[1](1);
  const setIndex = (newIndex: number) => {
    resetOtherLanguageIndex();
    setIndexPrivate(newIndex);
    preferencesIndex.set(newIndex % options.length);
  };
  const direction = useHebrew() ? "rtl" : "ltr";
  const axis = useHebrew() ? "x-reverse" : "x";
  function slideRenderer({index, key}: SlideRendererParams) {
    const component = options[index % options.length];
    const goPrevious = () => setIndex(index === 0 ? options.length - 1 : index - 1);
    const goNext = () => setIndex(index + 1);
    return <div key={key} style={{display: "flex"}}>
      <button
        className="mdl-button mdl-js-button mdl-button--icon mdl-button"
        onClick={useHebrew() ? goNext : goPrevious}>
        <i className="material-icons">chevron_left</i>
      </button>
      <div style={{flexGrow: 1, direction}}>
        {component}
      </div>
      <button
        className="mdl-button mdl-js-button mdl-button--icon mdl-button"
        onClick={useHebrew() ? goPrevious : goNext}>
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
      <div id="preferences-container" key="preferences-container" dir={direction}>
        {editingTheme !== null && (
          <ThemeEditor
            initialTheme={editingTheme}
            onClose={() => setEditingTheme(null)}
            onSave={combinedRerender}
          />
        )}
        <VirtualizeSwipeableViews
          key={`${useHebrew() ? "heb" : "eng"}_${rerenderCounter}`}
          axis={axis}
          slideRenderer={slideRenderer}
          index={currentIndex}
          onChangeIndex={setIndex}
          animateHeight />
      </div>,
    );
  }
  return <>{elements}</>;
}

interface LanguageChooserParams extends RerenderViewParams {
  children: React.ReactElement;
  padding: string;
}
export function LanguageChooser({
  rerender,
  children,
  padding,
}: LanguageChooserParams): React.ReactElement {
  const setSubmitted = useState(false)[1];
  const shouldShow = localStorage.needsToPickLanguage;
  const onClick = () => {
    delete localStorage.needsToPickLanguage;
    setSubmitted(true);
  };

  if (!shouldShow) {
    return children;
  }
  // TODO(versions): what about a Shas chooser?
  const option = preferenceOptions(rerender, [], "", () => {})[0];
  const buttonClasses = (
    "mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--colored");
  return (
    <div style={{padding}}>
      <h1>ברוכים הבאים! Welcome!</h1>
      {option}
      <button className={buttonClasses} onClick={onClick}>Enter // כניסה </button>
    </div>
  );
}
