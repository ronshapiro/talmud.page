import {parse as urlParse} from "url";
import {readUtf8} from "../files";
import {writeJson} from "../util/json_files";
import {RealRequestMaker, RequestMaker} from "../api_request_handler";

interface Endpoint {
  ref: string;
  requestBase: string;
}

function parseEndpoint(endpoint: string): Endpoint {
  const match = endpoint.match(/\/([a-z]+)\/(.*)\?.*/)!;
  const requestBase = match[1];

  if (requestBase === "bulktext") {
    const id = new URLSearchParams(urlParse(endpoint).query!).get("tp")!;
    return {requestBase, ref: id};
  }
  return {requestBase, ref: match[2]};
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
  new TestPage("Gittin", "85b"), // Has a link to Even HaEzer, Seder HaGet
  new TestPage("Kiddushin", "38a"), // Has a comment cycle
  new TestPage("Moed Katan", "21a"), // Has a link to Even HaEzer, Seder Halitzah
  new TestPage("Nazir", "33b"), // Has no gemara, just Tosafot
  new TestPage("Shabbat", "74b"), // Has weird API response with nested comment text from Rosh
  new TestPage("Tamid", "25b"), // No Rashi

  new TestPage("Shekalim", "2a"),
  new TestPage("Shekalim", "3a"), // Has spanningRefs
  new TestPage("Shekalim", "7b"), // Has strange text shape in the API response

  new TestPage("Genesis", "43"),
  new TestPage("Deuteronomy", "34"),
  new TestPage("I Samuel", "18"),
  new TestPage("Obadiah", "1"),

  new TestPage("SiddurAshkenaz", "Hodu"),
  new TestPage("SiddurAshkenaz", "Amidah_-_Opening"),
  new TestPage("SiddurSefard", "Hodu"),
  new TestPage("SiddurSefard", "Amidah_-_Opening"),
  new TestPage("BirkatHamazon", "Shir_Hama'alot"),
  new TestPage("BirkatHamazon", "Zimun"),
  new TestPage("BirkatHamazon", "Birkat_Hamazon"),
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
    return readUtf8(inputFilePath(parseEndpoint(endpoint)))
      .catch(e => {
        throw new Error(
          `Error opening ${e.path}. This likely means that the test data needs to be updated.`);
      })
      .then(content => JSON.parse(content) as T);
  }
}
