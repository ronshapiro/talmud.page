import {createContext, useContext} from "react";

export const ConfigurationContext = createContext();
export function useConfiguration() {
  return useContext(ConfigurationContext);
}

export const HiddenHostContext = createContext();
export function useHiddenHost() {
  return useContext(HiddenHostContext);
}
