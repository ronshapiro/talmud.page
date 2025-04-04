import * as React from "react";

const {createContext, useContext} = React;

const DEFAULT_CONTEXT = {
  versions: () => [],
  rendererType: "default",
};

export const ConfigurationContext = createContext<any>(undefined);
export function useConfiguration(): any {
  return useContext(ConfigurationContext) ?? DEFAULT_CONTEXT;
}

export const HiddenHostContext = createContext<any>(undefined);
export function useHiddenHost(): any {
  return useContext(HiddenHostContext);
}
