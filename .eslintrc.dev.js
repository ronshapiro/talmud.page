/* eslint-disable quote-props */

const TURN_OFF = {};

for (const key of [
  "comma-spacing",
  "key-spacing",
  "space-infix-ops",
  "no-console",
  "semi",
  "semi-spacing",
  "spaced-comment",
  "@typescript-eslint/no-extra-semi",
]) {
  TURN_OFF[key] = "off";
}

module.exports = {
  extends: [".eslintrc.js"],
  rules: {
    ...TURN_OFF,
  },
};