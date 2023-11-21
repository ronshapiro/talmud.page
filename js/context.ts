import * as React from "react";

const {createContext, useContext} = React;

export const ConfigurationContext = createContext<any>(undefined);
export function useConfiguration(): any {
  return useContext(ConfigurationContext);
}

export const HiddenHostContext = createContext<any>(undefined);
export function useHiddenHost(): any {
  return useContext(HiddenHostContext);
}
