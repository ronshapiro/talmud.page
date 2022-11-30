import {parse as urlParse} from "url";
import {readUtf8} from "./files";
import {writeJson} from "./util/json_files";
import {RealRequestMaker, RequestMaker} from "./api_request_handler";

export const TEST_DATA_ROOT = `${__dirname}/test_data/api_request_handler`;

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

function inputFileName(endpoint: Endpoint): string {
  return `${endpoint.ref.replace(/ /g, "_")}.${endpoint.requestBase}.input.json`;
}

abstract class FileRequestMaker extends RequestMaker {
  constructor(private rootDirectory: string) {
    super();
  }

  inputFile(endpoint: string): string {
    return `${this.rootDirectory}/${inputFileName(parseEndpoint(endpoint))}`;
  }
}

export class RecordingRequestMaker extends FileRequestMaker {
  private realRequestMaker = new RealRequestMaker();
  makeRequest<T>(endpoint: string): Promise<T> {
    const promise = this.realRequestMaker.makeRequest<T>(endpoint);
    promise.then(results => writeJson(this.inputFile(endpoint), results));
    return promise;
  }
}

export class FakeRequestMaker extends FileRequestMaker {
  makeRequest<T>(endpoint: string): Promise<T> {
    return readUtf8(this.inputFile(endpoint))
      .catch(e => {
        throw new Error(
          `Error opening ${e.path}. This likely means that the test data needs to be updated.`);
      })
      .then(content => JSON.parse(content) as T);
  }
}