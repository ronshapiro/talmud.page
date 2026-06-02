import * as React from "react";
import {throttle} from "underscore";
import Modal from "./Modal";
import {COLOR_VARIABLES} from "./themeConstants";
import {CustomTheme, saveCustomTheme, deleteCustomTheme, getCustomTheme, isCustomTheme} from "./CustomThemes";
import {upgradeElement} from "./componentHandler";

const {useState, useEffect, useRef, useMemo} = React;

function colorToHex(color: string): string {
  if (!color) return "";
  color = color.trim();
  if (color.startsWith("#")) {
    if (color.length === 4) {
      return "#" + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    return color;
  }
  const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
  if (match) {
    const r = parseInt(match[1], 10).toString(16).padStart(2, "0");
    const g = parseInt(match[2], 10).toString(16).padStart(2, "0");
    const b = parseInt(match[3], 10).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  return color;
}

interface ThemeEditorProps {
  onClose: () => void;
  onSave: () => void;
  onDelete: (themeName: string) => void;
  initialTheme?: CustomTheme;
}

export function ThemeEditor({
  onClose,
  onSave,
  onDelete,
  initialTheme,
}: ThemeEditorProps): React.ReactElement {
  const [initialCustomThemes] = useState(() => localStorage.getItem("customThemes"));
  const [initialDarkMode] = useState(() => localStorage.darkMode);
  const [name, setName] = useState(initialTheme?.name || "");
  const [baseTheme, setBaseTheme] = useState(() => {
    if (initialTheme) {
      return initialTheme.baseTheme;
    }
    const currentTheme = localStorage.darkMode || "false";
    const customTheme = isCustomTheme(currentTheme) ? getCustomTheme(currentTheme) : undefined;
    return customTheme ? customTheme.baseTheme : currentTheme;
  });
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    if (initialTheme?.overrides) {
      return initialTheme.overrides;
    }
    const computedStyles = getComputedStyle(document.body);
    const initialOverrides: Record<string, string> = {};
    for (const variable of COLOR_VARIABLES) {
      const value = computedStyles.getPropertyValue(variable).trim();
      if (value) {
        initialOverrides[variable] = colorToHex(value);
      }
    }
    return initialOverrides;
  });

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (nameInputRef.current?.parentElement) {
      upgradeElement(nameInputRef.current.parentElement);
    }
  }, []);

  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const updateTheme = (
    themeName: string, baseThemeName: string, newOverrides: Record<string, string>,
  ) => {
    saveCustomTheme(
      {name: themeName || "Draft", baseTheme: baseThemeName, overrides: newOverrides});
    onSaveRef.current();
  };
  const throttledUpdateTheme = useMemo(() => throttle(updateTheme, 50), []);

  const handleColorChange = (variable: string, color: string) => {
    setOverrides(prev => {
      const newOverrides = {...prev, [variable]: color};
      // Live update by calling onSave with the current draft state
      throttledUpdateTheme(name, baseTheme, newOverrides);
      return newOverrides;
    });
  };

  const handleBaseThemeChange = (newBaseTheme: string) => {
    setBaseTheme(newBaseTheme);

    localStorage.darkMode = newBaseTheme;

    const linkElement = (id: string) => (document.getElementById(id) as HTMLLinkElement);
    linkElement("darkModeCss").disabled = (newBaseTheme !== "true");
    linkElement("grayModeCss").disabled = (newBaseTheme !== "gray");

    const root = document.documentElement;
    for (const variable of COLOR_VARIABLES) {
      root.style.removeProperty(variable);
    }

    const computedStyles = getComputedStyle(document.body);
    const newOverrides: Record<string, string> = {};

    for (const variable of COLOR_VARIABLES) {
      const value = computedStyles.getPropertyValue(variable).trim();
      if (value) {
        newOverrides[variable] = colorToHex(value);
      }
    }

    setOverrides(newOverrides);
    throttledUpdateTheme(name, newBaseTheme, newOverrides);
  };

  const handleCancel = () => {
    if (initialCustomThemes !== null) {
      localStorage.setItem("customThemes", initialCustomThemes);
    } else {
      localStorage.removeItem("customThemes");
    }
    if (initialDarkMode !== undefined && initialDarkMode !== null) {
      localStorage.setItem("darkMode", initialDarkMode);
    } else {
      localStorage.removeItem("darkMode");
    }
    onSave();
    onClose();
  };

  const handleSave = () => {
    if (!name) {
      // eslint-disable-next-line no-alert
      alert("Please enter a theme name");
      return;
    }
    if (["true", "gray", "false"].includes(name.toLowerCase())) {
      // eslint-disable-next-line no-alert
      alert("This name is reserved. Please choose another name.");
      return;
    }
    if (initialTheme && initialTheme.name !== name) {
      deleteCustomTheme(initialTheme.name);
    }
    saveCustomTheme({name, baseTheme, overrides});
    onSave();
    onClose();
  };

  const content = (
    <div style={{maxHeight: "35vh", overflowY: "auto", padding: "10px 10px 40px 10px", direction: "ltr"}}>
      <div className="mdl-textfield mdl-js-textfield mdl-textfield--floating-label" style={{width: "100%"}}>
        <input
          className="mdl-textfield__input"
          type="text"
          id="theme-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          ref={nameInputRef}
        />
        {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
        <label className="mdl-textfield__label" htmlFor="theme-name">Theme Name</label>
      </div>

      <div style={{marginTop: "10px"}}>
        <span>Base Theme: </span>
        {["false", "true", "gray"].map(theme => {
          const displayText = (
            theme === "false" ? "Light" : (theme === "true" ? "Dark" : "Gray")
          );
          const id = `base-theme-${theme}`;
          return (
            <label key={theme} className="mdl-radio mdl-js-radio mdl-js-ripple-effect" style={{marginRight: "10px"}} htmlFor={id}>
              <input
                type="radio"
                className="mdl-radio__button"
                name="baseTheme"
                id={id}
                value={theme}
                checked={baseTheme === theme}
                onChange={() => handleBaseThemeChange(theme)}
              />
              <span className="mdl-radio__label">{displayText}</span>
            </label>
          );
        })}
      </div>

      <div style={{marginTop: "20px"}}>
        {COLOR_VARIABLES.map(variable => (
          <div key={variable} style={{display: "flex", alignItems: "center", marginBottom: "8px"}}>
            <span style={{flexGrow: 1, fontSize: "12px"}}>{variable}</span>
            <input
              type="text"
              style={{width: "80px", marginRight: "8px"}}
              value={overrides[variable] || ""}
              placeholder="e.g. #ffffff"
              onChange={(e) => handleColorChange(variable, e.target.value)}
            />
            <input
              type="color"
              value={colorToHex(overrides[variable]) || "#000000"}
              onChange={(e) => handleColorChange(variable, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const extraButtons = initialTheme ? [
    <button
      key="delete"
      className="mdl-button mdl-js-button mdl-js-ripple-effect mdl-button--primary"
      onClick={() => {
        onDelete(initialTheme.name);
        onClose();
      }}>
      Delete
    </button>,
  ] : [];

  return (
    <Modal
      content={content}
      cancelText="Cancel"
      cancelTextHebrew="ביטול"
      onCancel={handleCancel}
      acceptText="Save"
      acceptTextHebrew="שמור"
      onAccept={handleSave}
      extraButtons={extraButtons}
      isBottom
    />
  );
}
