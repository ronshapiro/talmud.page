/* eslint-disable quote-props */

module.exports = {
  env: {
    browser: true,
    es2020: true,
    jest: true,
  },
  extends: [
    "plugin:react/recommended",
    "airbnb",
  ],
  parser: "babel-eslint",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 11,
    sourceType: "module",
  },
  plugins: [
    "react",
  ],
  rules: {
    "arrow-body-style": "off",
    "arrow-parens": "off",
    "function-paren-newline": "off",
    "import/extensions": "off",
    "max-classes-per-file": "off",
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-else-return": "off",
    "no-plusplus": "off",
    "no-trailing-spaces": "off", // pre-commit will enforce this
    "no-underscore-dangle": "off",
    "quotes": "off", // In general this is awfully noisy; ideally it would be ["error", "double"]
    "react/destructuring-assignment": "off",
    "react/no-unknown-property": ["error", {
      ignore: ["class", "onclick", "onkeyup", "tabindex"], // Preact
    }],

    // TODO: evaluate all of the rules below
    "jsx-a11y/no-static-element-interactions": "off",
    "jsx-a11y/anchor-is-valid": "off",
    "jsx-a11y/no-noninteractive-tabindex": "off",
    "indent": "off", // TODO: cleanup
    "import/named": "off", // unclear why eslint can't find imports
    "no-param-reassign": "off",
    "react/react-in-jsx-scope": "off",
    "react/jsx-closing-bracket-location": "off",
    "react/sort-comp": "off",
    "react/state-in-constructor": "off",
    "react/prop-types": "off", // preact doesn't have PropTypes
    "object-curly-newline": "off",
    "class-methods-use-this": "off",
    "no-restricted-syntax": "off",
    "no-undef-init": "off",
    "object-curly-spacing": "off",
    "prefer-template": "off",
    "radix": "off",
    "react/prefer-stateless-function": "off",
  },
  overrides: [
    {
      files: ["*.test.js"],
      rules: {
        "no-undef": "off",
      },
    },
    {
      files: ["js/masechtot.js", "js/preferences_sample_data.js"],
      rules: {
        "quote-props": "off",
        "comma-dangle": "off",
      },
    },
  ],
};
