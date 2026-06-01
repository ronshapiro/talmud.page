import {useEffect, useRef, useState} from "react";

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
    (document.getElementById("darkModeCss") as HTMLLinkElement).disabled = (
      localStorage.darkMode !== "true");
    (document.getElementById("grayModeCss") as HTMLLinkElement).disabled = (
      localStorage.darkMode !== "gray");
    for (const id of ["theme-color", "theme-color-dark-mode"]) {
      (document.getElementById(id) as HTMLMetaElement).content = (
        getComputedStyle(document.body).getPropertyValue('--background-color'));
    }
  });
}
