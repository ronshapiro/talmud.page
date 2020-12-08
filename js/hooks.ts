import {useRef} from "react";

export function useHtmlRef(): React.MutableRefObject<HTMLInputElement> {
  return useRef<HTMLInputElement>(undefined as any);
}
