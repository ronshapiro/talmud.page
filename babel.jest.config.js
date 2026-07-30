/**
 * Babel configuration used only by jest. `babel.config.js` (used by Parcel for the real bundle)
 * is deliberately left untouched.
 *
 * Two differences from the production config:
 *  - `targets: node current`, so generators and async functions are left alone. The production
 *    config's browser targets rewrite them through `regeneratorRuntime`, which is supplied by the
 *    bundle's polyfills but not by jest.
 *  - JSX transformation, which Parcel handles itself for `.tsx` files.
 */
module.exports = {
  presets: [
    ["@babel/preset-env", {targets: {node: "current"}}],
    "@babel/preset-typescript",
  ],
  plugins: [
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-transform-react-jsx",
  ],
};
