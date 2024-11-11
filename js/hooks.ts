import {useRef, useState} from "react";

export function useHtmlRef<T>(): React.MutableRefObject<T> {
  return useRef<T>(undefined as any);
}

export function useIncrementer(value = 0): [number, () => void] {
  const [state, setState] = useState(value);
  return [state, () => setState(old => old + 1)];
}
