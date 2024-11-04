import * as React from "react";

const {
  useRef,
  useState,
} = React;

export function useArrayStateBackedByLength<T>(array: T[]): [T[], (array: T[]) => void] {
  // React treats all setState(<array>) as updates, even if the contents have not changed (test with
  // `setX([1])`: this will loop infinitely). As a workaround, if the order and elements of the
  // state is stable, the length can be used as the actual state and the contents can be stored in a
  // Ref.
  const ref = useRef(array);
  const setLength = useState(0)[1];
  return [ref.current, (newArray: T[]) => {
    ref.current = newArray;
    setLength(newArray.length);
  }];
}
