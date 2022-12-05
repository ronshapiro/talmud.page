import {useRef} from "react";

export function useHtmlRef<T>(): React.MutableRefObject<T> {
  return useRef<T>(undefined as any);
}
