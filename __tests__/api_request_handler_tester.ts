/* eslint-disable import/first */
jest.mock("../fetch.ts", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
  const fetch = require("make-fetch-happen");
  return {fetch};
});

import * as fs from "fs";
import {jsonStringify} from "../util/json_stringify";
import {ApiRequestHandler} from "../api_request_handler";
import {testPages} from "./api_request_handler_base";
import {FakeRequestMaker, TEST_DATA_ROOT} from "../request_makers";
import {NoopLogger} from "../logger";

export function testTitle(title: string): void {
  const handler = new ApiRequestHandler(new FakeRequestMaker(TEST_DATA_ROOT));
  const pages = testPages.filter(page => page.title === title);
  test.each(pages)("%s", testPage => {
    return handler.handleRequest(testPage.title, testPage.page, new NoopLogger())
      .then(results => {
        const expected = fs.readFileSync(testPage.outputFilePath(), {encoding: "utf-8"});
        expect(jsonStringify(results)).toBe(expected);
      });
  });
}
