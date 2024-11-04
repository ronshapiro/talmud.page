/* eslint-disable import/first */
jest.mock("../fetch.ts", () => {
  return {fetch: "unused"};
});

import * as fs from "fs";
import {testPages} from "./api_request_handler_base";

test("All pages exist", () => {
  const titles = new Set();
  for (const page of testPages) {
    if (titles.has(page.title)) {
      continue;
    }
    fs.statSync(`__tests__/${page.title.replace(/ /g, "_")}.test.ts`);
  }
});
