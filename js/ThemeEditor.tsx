import * as React from "react";
import Modal from "./Modal";
import {COLOR_VARIABLES} from "./themeConstants";
import {CustomTheme, saveCustomTheme} from "./CustomThemes";
import {upgradeElement} from "./componentHandler";

const {useState, useEffect, useRef} = React;

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
  const [name, setName] = useState(initialTheme?.name || "");
  const [baseTheme, setBaseTheme] = useState(initialTheme?.baseTheme || "false");
  const [overrides, setOverrides] = useState<Record<string, string>>(initialTheme?.overrides || {});

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (nameInputRef.current?.parentElement) {
      upgradeElement(nameInputRef.current.parentElement);
    }
  }, []);

  const handleColorChange = (variable: string, color: string) => {
    setOverrides(prev => {
      const newOverrides = {...prev, [variable]: color};
      // Live update by calling onSave with the current draft state
      saveCustomTheme({name: name || "Draft", baseTheme, overrides: newOverrides});
      onSave();
      return newOverrides;
    });
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
    saveCustomTheme({name, baseTheme, overrides});
    onSave();
    onClose();
  };

  const content = (
    <div style={{maxHeight: "35vh", overflowY: "auto", padding: "10px 10px 40px 10px"}}>
      <div className="mdl-textfield mdl-js-textfield mdl-textfield--floating-label" style={{width: "100%"}}>
        <label className="mdl-textfield__label" htmlFor="theme-name">Theme Name
          <input
            className="mdl-textfield__input"
            type="text"
            id="theme-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            ref={nameInputRef}
          />
        </label>
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
                onChange={() => setBaseTheme(theme)}
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
              value={overrides[variable]?.startsWith("#") ? overrides[variable] : "#000000"}
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
      className="mdl-button mdl-js-button mdl-js-ripple-effect"
      style={{color: "red"}}
      onClick={() => {
        if (window.confirm(`Delete theme "${initialTheme.name}"?`)) {
          onDelete(initialTheme.name);
          onClose();
        }
      }}>
      Delete
    </button>,
  ] : [];

  return (
    <Modal
      content={content}
      cancelText="Cancel"
      cancelTextHebrew="ביטול"
      onCancel={onClose}
      acceptText="Save"
      acceptTextHebrew="שמור"
      onAccept={handleSave}
      extraButtons={extraButtons}
      isBottom
    />
  );
}
