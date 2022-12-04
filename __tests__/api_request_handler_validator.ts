/* eslint-disable import/first */
jest.mock("../fetch.ts", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
  const fetch = require("make-fetch-happen");
  return {fetch};
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
