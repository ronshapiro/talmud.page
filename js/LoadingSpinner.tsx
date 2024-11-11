import * as React from "react";

export function LoadingSpinner(): React.ReactElement {
  const classes = [
    "text-loading-spinner",
    "mdl-spinner",
    "mdl-spinner--single-color",
    "mdl-js-spinner",
    "is-active",
  ];
  return <div className={classes.join(" ")} />;
}
