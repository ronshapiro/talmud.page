import {createContext, useContext} from "react";

const contexts = {};

// Rewrite this and then get rid of the import/named suppression warning in eslint

const declareContext = name => {
  const context = createContext();
  contexts[`${name}Context`] = context;
  contexts[`use${name}`] = function useDeclaredContext() {
    return useContext(context);
  };
};

declareContext("Configuration");
declareContext("HiddenHost");

module.exports = contexts;
