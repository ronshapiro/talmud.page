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
    'plugin:@typescript-eslint/recommended',
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 11,
    sourceType: "module",
  },
  plugins: [
    "react",
    '@typescript-eslint',
  ],
  rules: {
    "arrow-body-style": "off",
    "arrow-parens": "off",
    "class-methods-use-this": "off",
    "function-paren-newline": "off",
    "import/extensions": "off",
    "import/prefer-default-export": "off",
    "import/no-unresolved": "off",
    "lines-between-class-members": ["error", "always", {exceptAfterSingleLine: true}],
    "max-classes-per-file": "off",
    "no-continue": "off",
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-else-return": "off",
    "no-plusplus": "off",
    "no-trailing-spaces": "off", // pre-commit will enforce this
    "no-underscore-dangle": "off",
    "no-useless-constructor": "off",
    "@typescript-eslint/no-useless-constructor": ["error"],
    "object-curly-newline": "off",
    "object-curly-spacing": "off",
    "prefer-template": "off",
    "quotes": "off", // In general this is awfully noisy; ideally it would be ["error", "double"]
    "radix": "off",
    "react/destructuring-assignment": "off",
    "react/static-property-placement": "off",
    "no-restricted-syntax": "off",
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-use-before-define": "off",
    "@typescript-eslint/no-use-before-define": ["error"],
    "spaced-comment": ["error", "always", {
      "block": {
        "exceptions": ["/"],
      },
    }],
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",


    // These rules may be removable with some work
    "no-param-reassign": "off",
    "react/button-has-type": "off",
    "react/jsx-closing-bracket-location": "off",
    "react/sort-comp": "off",
    "react/state-in-constructor": "off",
    "react/require-default-props": "off",
    "react/forbid-prop-types": "off",
  },
  overrides: [
    {
      files: ["*.test.js"],
      rules: {
        "no-undef": "off",
      },
    },
    {
      files: ["js/books.ts", "js/commentaries.ts", "js/preferences_sample_data.js"],
      rules: {
        "quote-props": "off",
        "comma-dangle": "off",
      },
    },
    {
      files: ["*.js", "*.jsx"],
      rules: {
        "@typescript-eslint/explicit-module-boundary-types": "off",
      },
    },
    {
      files: ["*.tsx"],
      rules: {
        "react/jsx-filename-extension": "off",
      },
    },
  ],
};
