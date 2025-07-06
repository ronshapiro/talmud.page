import * as React from "react";
import ContentEditable from "react-contenteditable";
// import {animated, useSpring} from "@react-spring/web"; // No longer directly used here for Snackbar itself
import {useConfiguration} from "./context";
import {useHtmlRef} from "./hooks";
import {sanitizeHtml} from "../source_formatting/html_sanitization_web";
// import {NullaryFunction} from "./types"; // No longer needed for CloseSnackbarFn
import {useScrollTo} from "./useScrollTo";
import { GenericSnackbar, SnackbarButtonProps as GenericSnackbarButtonProps } from "./GenericSnackbar"; // Import GenericSnackbar

const {
  useCallback,
  useEffect,
  // useRef, // No longer needed for close ref in IndividualSearchRow
  useState,
} = React;

function useIsEnglish(): boolean {
  const {translationOption} = useConfiguration();
  return translationOption() === "english-side-by-side";
}

// This custom SnackbarButton can be removed if GenericSnackbar's button styling is sufficient
// or kept if specific MDL styling not covered by GenericSnackbar is needed.
// For now, let's assume GenericSnackbarButtonProps will be used.
// interface SnackbarButtonProps {
//   children: any;
//   disabled?: boolean;
//   onClick: () => void;
//   extraClasses?: string[];
// }

// function SnackbarButton({children, disabled, onClick, extraClasses}: SnackbarButtonProps) {
//   const buttonClasses = [
//     "mdl-button",
//     "mdl-js-button",
//     (localStorage.darkMode !== "true") ? "mdl-button--colored" : "mdl-button--normal-text-color",
//   ].concat(extraClasses || []).join(" ");
//   return (
//     <button className={buttonClasses} disabled={disabled} onClick={onClick}>
//       {children}
//     </button>
//   );
// }

// The old Snackbar component is replaced by GenericSnackbar.
// IndividualSearchRow will now use GenericSnackbar directly.
// type CloseSnackbarFn = NullaryFunction<Promise<unknown>>;

// interface SnackbarProps {
//   children: any;
//   close?: React.MutableRefObject<CloseSnackbarFn | undefined>;
// }

// function Snackbar({children, close}: SnackbarProps): React.ReactElement {
//   const [style, api] = useSpring(() => { return {height: "0px"}; });
//   const [showingState, setShowingState] = useState("starting");

//   useEffect(() => {
//     if (showingState === "starting") {
//       setShowingState("showing");
//       api.start({height: "36px"});
//     }
//   });
//   if (close) {
//     close.current = () => Promise.all(api.start({height: "0px"})).then(() => {
//       setShowingState("closed");
//     });
//   }

//   const isEnglish = useIsEnglish();
//   const direction = isEnglish ? "ltr" : "rtl";
//   return (
//     <animated.div className="snackbar inPageSearch" dir={direction} style={style}>
//       {children}
//     </animated.div>
//   );
// }

function unescapeHtml(text: string): string {
  return (
    text
      .replaceAll("&amp;", "&")
      .replaceAll("&nbsp;", " ")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
  );
}

type UpdateSearchQuery = (key: string, query: string, asRegex: boolean | undefined) => void;

interface SearchProps {
  queryCount: number;
  updateSearchQuery: UpdateSearchQuery;
}

const COLORS = ["yellow", "purple", "green", "red", "blue", "gray"];

type RecordFunction<V> = (x: Record<string, V>) => Record<string, V>;
type RecordSetter<V> = (fn: RecordFunction<V>) => void;

function recordStateSetter<V>(setter: RecordSetter<V>) {
  return (key: string, value: V) => {
    setter(oldValue => {
      const newValue = {...oldValue};
      newValue[key] = value;
      return newValue;
    });
  };
}

export function SnackbarHost({
  updateSearchQuery,
  // This doesn't actually do anything, but it does help ensure that when the query changes
  // this gets rerendered.
  queryCount, // eslint-disable-line @typescript-eslint/no-unused-vars
}: SearchProps): React.ReactElement {
  const [isShowing, setShowing] = useState(false);
  // `colors` saves the ordering and presence of colors.
  const [colors, setColors] = useState([COLORS[0]]);
  const [contentsByColor, setContentsByColor] = useState({} as Record<string, string | undefined>);
  const setContentForColor = recordStateSetter(setContentsByColor);
  const canAddMoreColors = colors.length !== COLORS.length;

  const button = (kind: string, onClick: () => void) => {
    return (
      <button
        key={kind}
        className="mdl-button mdl-js-button mdl-button--icon"
        onClick={onClick}>
        <i className="material-icons">{kind}</i>
      </button>
    );
  };
  const addNewSearch = (initialText?: string) => {
    for (const color of COLORS) {
      if (!colors.includes(color)) {
        setColors([...colors, color]);
        setContentForColor(color, initialText);
        break;
      }
    }
  };
  const newSearchWithText = (initialText: string) => {
    setShowing(true);

    const latestColor = colors.slice(-1)[0];
    const latestContent = contentsByColor[latestColor];
    if (latestColor && (latestContent === undefined || latestContent === "")) {
      setContentForColor(latestColor, initialText);
    } else {
      addNewSearch(initialText);
    }
  };
  (window as any).SEARCH = canAddMoreColors && newSearchWithText;
  const removeSearch = (color: string) => {
    setColors(oldColors => {
      const newColors = oldColors.filter(x => x !== color);
      setShowing(newColors.length > 0);
      return newColors;
    });
  };

  const onSearchShowHideClick = () => {
    setShowing(previous => {
      if (!previous && colors.length === 0) {
        setColors([COLORS[0]]);
      }
      return !previous;
    });
  };

  const elements = [
    <div id="showSearch" key="showSearch">
      {button("search", onSearchShowHideClick)}
      {isShowing && canAddMoreColors ? button("add", () => addNewSearch()) : null}
    </div>,
  ];

  if (isShowing) {
    /* eslint-disable @typescript-eslint/no-use-before-define */
    const actualSnackbars = colors.map(color => (
      <IndividualSearchRow
        key={color}
        color={color}
        updateSearchQuery={updateSearchQuery}
        removeSearch={() => removeSearch(color)}
        content={contentsByColor[color] || ""}
        setContent={(newContent) => setContentForColor(color, newContent)}
        />));
    elements.push(<div id="snackbars" key="snackbars">{actualSnackbars}</div>);
    /* eslint-enable @typescript-eslint/no-use-before-define */
  }

  return <div id="snackbarHost" className={isShowing ? "showing" : ""}>{elements}</div>;
}

interface IndividualSearchRowProps {
  color: string;
  updateSearchQuery: UpdateSearchQuery;
  removeSearch: () => void;
  content: string;
  setContent: (_: string) => void;
}
function IndividualSearchRow({
  color,
  updateSearchQuery,
  removeSearch,
  content,
  setContent,
}: IndividualSearchRowProps): React.ReactElement {
  const [localContent, setLocalContent] = useState("");
  const inheritedSetContent = setContent;
  setContent = (newContent: string) => {
    inheritedSetContent(newContent);
    setLocalContent(newContent);
  };
  const contentEditableRef = useHtmlRef<HTMLElement>();
  const scrolling = useScrollTo(`.foundTerm.${color}`);
  const {matches, currentMatch, scrollToDiffedIndex} = scrolling;

  const [asRegex, setAsRegexBase] = useState(false);
  const updateRegex = useCallback((overrideAsRegexValue?: boolean) => {
    const newText = unescapeHtml(sanitizeHtml(contentEditableRef.current.innerHTML).trim());
    setContent(newText); // This will also update localContent via useEffect or direct call
    const asRegexValue = overrideAsRegexValue !== undefined ? overrideAsRegexValue : asRegex;
    updateSearchQuery(color, newText.trim(), asRegexValue);
    scrolling.clearState();
  }, [asRegex, contentEditableRef, setContent, updateSearchQuery, scrolling, color]); // Added dependencies

  const setAsRegex = (value: boolean) => {
    setAsRegexBase(value);
    updateRegex(value); // updateRegex will use the new `value` for asRegexValue
  };

  useEffect(() => {
    // This effect syncs parent content changes to local state and updates search query
    if (content !== localContent) {
      setLocalContent(content); // Update local state to reflect parent change
      // It might be redundant to call updateSearchQuery here if parent `content` change implies query was already updated.
      // However, to be safe and ensure consistency:
      const newText = unescapeHtml(sanitizeHtml(content).trim());
      updateSearchQuery(color, newText, asRegex);
    }
  }, [content, localContent, updateSearchQuery, color, asRegex]); // Added dependencies

  const isEnglish = useIsEnglish();
  const [isVisible, setIsVisible] = useState(true); // Control visibility for GenericSnackbar

  const handleDismiss = () => {
    setIsVisible(false);
    // After animation (handled by GenericSnackbar), we want to remove the search row
    // We need a slight delay or a callback from GenericSnackbar's onRest if possible
    // For now, using a timeout to approximate animation finishing
    setTimeout(() => {
      removeSearch();
    }, 300); // Adjust timeout to match animation
  };

  const onClear = () => {
    if (content.length === 0) {
      handleDismiss(); // Dismiss and then remove
    } else {
      setContent(""); // Clear content, which will trigger updateSearchQuery via useEffect or updateRegex
      updateSearchQuery(color, "", undefined); // Explicitly clear query
    }
  };

  const snackbarMessage = (
    <ContentEditable
      tagName="span"
      className="inPageSearchBar"
      placeholder={isEnglish ? "Search..." : "חפש..."}
      html={content} // Bind to the parent-passed content for initial render
      innerRef={contentEditableRef}
      onChange={() => updateRegex()} // updateRegex now reads from contentEditableRef.current.innerHTML
    />
  );

  const currentMatchText = currentMatch === undefined ? "" : (currentMatch + 1).toString();
  const matchCounterDisplay = (
    matches > 0
      ? <span key="matchCounter" className="searchMatchCounter">{currentMatchText} / {matches}</span>
      : null
  );
  const navDisabled = matches <= 1;

  const snackbarButtons: GenericSnackbarButtonProps[] = [
    {
      key: "clear", // React key
      text: <i className="material-icons">close</i>,
      onClick: onClear,
      className: "mdl-button--icon",
    },
    // Placeholder for matchCounter, as GenericSnackbar buttons are typically interactive.
    // Match counter will be part of the message or a separate element if design allows.
    // For now, let's include it in the text part or next to buttons if possible.
    // This part needs careful placement. We might need to adjust GenericSnackbar or how content is structured.
    // Option: pass it as part of a composite message.
    // Option: GenericSnackbar could support a `suffix` or `prefix` element prop.
    // For now, let's make it simple:
    {
      key: "regex",
      text: "/.*/",
      onClick: () => setAsRegex(!asRegex),
      className: asRegex ? "mdl-button--raised" : "",
    },
    {
      key: "down",
      text: <i className="material-icons">arrow_downward</i>,
      onClick: () => scrollToDiffedIndex(1),
      className: navDisabled ? "mdl-button--disabled" : "",
      disabled: navDisabled,
    },
    {
      key: "up",
      text: <i className="material-icons">arrow_upward</i>,
      onClick: () => scrollToDiffedIndex(-1),
      className: navDisabled ? "mdl-button--disabled" : "",
      disabled: navDisabled,
    },
  ];

  // We need to handle the display of matchCounterText.
  // One way is to include it in the message, or have GenericSnackbar support an additional element.
  // For now, let's create a composite message for GenericSnackbar.
  const compositeMessage = (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      {snackbarMessage}
      {matchCounterDisplay && <span style={{ marginLeft: '8px', marginRight: '8px' }}>{matchCounterDisplay}</span>}
    </div>
  );


  return (
    <GenericSnackbar
      id={`search-${color}`}
      message={compositeMessage}
      buttons={snackbarButtons}
      isVisible={isVisible}
      onDismiss={handleDismiss} // This will be called on auto-hide or if GenericSnackbar implements a manual dismiss button
      kind="inPageSearch" // Custom kind for specific styling if needed
      autoHideDuration={null} // Search snackbars typically are not auto-hidden
    />
  );
}
