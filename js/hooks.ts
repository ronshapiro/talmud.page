import {useEffect, useRef, useState} from "react";
import {getCustomTheme, isCustomTheme} from "./CustomThemes";
import {getColorVariables} from "./themeConstants";

export function useHtmlRef<T>(): React.MutableRefObject<T> {
  return useRef<T>(undefined as any);
}

export function useIncrementer(value = 0): [number, () => void] {
  const [state, setState] = useState(value);
  return [state, () => setState(old => old + 1)];
}

export function useAlternator(defaultValue: boolean): [boolean, () => void] {
  const [state, setState] = useState(defaultValue);
  return [state, () => setState(old => !old)];
}

export function useUpdateDarkMode(): void {
  useEffect(() => {
    const {darkMode} = localStorage;
    const customTheme = isCustomTheme(darkMode) ? getCustomTheme(darkMode) : undefined;
    const baseTheme = customTheme ? customTheme.baseTheme : darkMode;

    (document.getElementById("darkModeCss") as HTMLLinkElement).disabled = (
      baseTheme !== "true");
    (document.getElementById("grayModeCss") as HTMLLinkElement).disabled = (
      baseTheme !== "gray");

    const root = document.documentElement;
    // Always clear custom properties first to avoid "sticky" styles when switching
    // between custom themes.
    for (const variable of getColorVariables()) {
      root.style.removeProperty(variable);
    }
    if (customTheme) {
      for (const [variable, value] of Object.entries(customTheme.overrides)) {
        root.style.setProperty(variable, value);
      }
    }

    for (const id of ["theme-color", "theme-color-dark-mode"]) {
      (document.getElementById(id) as HTMLMetaElement).content = (
        getComputedStyle(document.body).getPropertyValue('--background-color'));
    }
  });
}
