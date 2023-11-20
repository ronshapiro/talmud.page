import {parse as urlParse} from "url";
import {fetch} from "./fetch";
import {readUtf8Async} from "./files";
import {steinsaltzApiUrl} from "./steinsaltz";
import {writeJson} from "./util/json_files";

export abstract class RequestMaker {
  abstract makeRequest<T>(endpoint: string): Promise<T>;
  abstract makeSteinsaltzRequest(masechet: string, daf: string): Promise<any>;
}

const RETRY_OPTIONS = {
  retry: {
    retries: 4,
    minTimeout: 200,
  },
};

const STEINSALTZ_OPTIONS = {
  headers: {
    "api-key": "Qt23AFSTt9AAXhct",
  },
  ...RETRY_OPTIONS,
};

export class RealRequestMaker extends RequestMaker {
  makeRequest<T>(endpoint: string): Promise<T> {
    return fetch(`https://sefaria.org/api${encodeURI(endpoint)}`, RETRY_OPTIONS)
      .then(x => x.json())
      .then(json => (json.error ? Promise.reject(json) : Promise.resolve(json)));
  }

  makeSteinsaltzRequest(masechet: string, daf: string): Promise<any> {
    return fetch(steinsaltzApiUrl(masechet, daf), STEINSALTZ_OPTIONS)
      .then(x => x.json())
      .then(json => (json.error ? Promise.reject(json) : Promise.resolve(json)));
  }
}

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

  steinsaltzInputFile(masechet: string, daf: string): string {
    return `${this.rootDirectory}/steinsaltz/${masechet}_${daf}.json`;
  }
}

export class RecordingRequestMaker extends FileRequestMaker {
  private realRequestMaker = new RealRequestMaker();
  makeRequest<T>(endpoint: string): Promise<T> {
    const promise = this.realRequestMaker.makeRequest<T>(endpoint);
    promise.then(results => writeJson(this.inputFile(endpoint), results));
    return promise;
  }

  makeSteinsaltzRequest(masechet: string, daf: string): Promise<any> {
    const promise = this.realRequestMaker.makeSteinsaltzRequest(masechet, daf);
    promise.then(results => {
      delete results.details.speed;
      writeJson(this.steinsaltzInputFile(masechet, daf), results);
    });
    return promise;
  }
}

export class FakeRequestMaker extends FileRequestMaker {
  makeRequest<T>(endpoint: string): Promise<T> {
    return this.readJson<T>(this.inputFile(endpoint));
  }

  makeSteinsaltzRequest(masechet: string, daf: string): Promise<any> {
    return this.readJson<any>(this.steinsaltzInputFile(masechet, daf));
  }

  private readJson<T>(fileName: string): Promise<T> {
    return readUtf8Async(fileName)
      .catch(e => {
        throw new Error(
          `Error opening ${e.path}. This likely means that the test data needs to be updated.`);
      })
      .then(content => JSON.parse(content) as T);
  }
}
