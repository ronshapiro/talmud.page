import * as React from "react";

export default function isEmptyText(
  stringOrList: string | string[] | React.ReactElement | undefined): boolean {
  if (stringOrList === undefined) {
    return false;
  }
  return !stringOrList || stringOrList === "" || (
    typeof stringOrList === "string" && stringOrList.length === 0);
}
