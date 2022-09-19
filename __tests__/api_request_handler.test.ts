/* eslint-disable import/first */
jest.mock("../fetch.ts", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
  const fetch = require("make-fetch-happen");
  return {fetch};
});

import * as fs from "fs";
import {jsonStringify} from "../util/json_stringify";
import {ApiRequestHandler} from "../api_request_handler";
import {FakeRequestMaker, testPages} from "./api_request_handler_base";
import {NoopLogger} from "../logger";

const handler = new ApiRequestHandler(new FakeRequestMaker());
test.each(testPages)("%s", testPage => {
  return handler.handleRequest(testPage.title, testPage.page, new NoopLogger())
    .then(results => {
      const expected = fs.readFileSync(testPage.outputFilePath(), {encoding: "utf-8"});
      expect(jsonStringify(results)).toBe(expected);
    });
});
