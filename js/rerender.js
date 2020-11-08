import {
  useState,
} from "react";

export default function useRerender() {
  const setRenderCount = useState(0)[1];
  return () => setRenderCount(x => x + 1);
}
