import * as fs from "fs";
import {writeJson} from "../util/json_files";
import {RealRequestMaker, RequestMaker} from "../api_request_handler";

interface Endpoint {
  ref: string;
  requestBase: string;
}

function parseEndpoint(endpoint: string): Endpoint {
  const match = endpoint.match(/\/(texts|links)\/(.*)\?.*/)!;
  return {requestBase: match[1], ref: match[2]};
}

function testDataPath(path: string): string {
  return `${__dirname}/../test_data/api_request_handler/${path}`;
}

function inputFilePath(endpoint: Endpoint): string {
  return testDataPath(`${endpoint.ref.replace(/ /g, "_")}.${endpoint.requestBase}.input.json`);
}

class TestPage {
  constructor(readonly title: string, readonly page: string) {}

  outputFilePath(): string {
    return testDataPath(`${this.title.replace(/ /g, "_")}.${this.page}.expected-output.json`);
  }
}

export const testPages = [
  new TestPage("Berakhot", "2a"),
  new TestPage("Berakhot", "34b"),
  new TestPage("Shabbat", "100a"),
  new TestPage("Eruvin", "11a"), // Has images
  new TestPage("Eruvin", "6b"), // Has images, including a comment with multiple images
  new TestPage("Eruvin", "105a"), // Ends with Hadran that has vocalization
  new TestPage("Nazir", "33b"), // Has no gemara, just Tosafot
  new TestPage("Shabbat", "74b"), // Has weird API response with nested comment text from Rosh
  new TestPage("Tamid", "25b"), // No Rashi

  new TestPage("Genesis", "43"),
  new TestPage("Deuteronomy", "34"),
  new TestPage("I Samuel", "18"),
  new TestPage("Obadiah", "1"),
];

export class RecordingRequestMaker extends RequestMaker {
  private realRequestMaker = new RealRequestMaker();

  makeRequest<T>(endpoint: string): Promise<T> {
    const promise = this.realRequestMaker.makeRequest<T>(endpoint);
    promise.then(results => writeJson(inputFilePath(parseEndpoint(endpoint)), results));
    return promise;
  }
}

export class FakeRequestMaker extends RequestMaker {
  makeRequest<T>(endpoint: string): Promise<T> {
    return fs.promises.readFile(inputFilePath(parseEndpoint(endpoint)), {encoding: "utf-8"})
      .then(content => JSON.parse(content) as T);
  }
}
