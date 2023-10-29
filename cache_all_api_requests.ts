/* eslint-disable no-console */
import * as fs from "fs";
import {ApiRequestHandler} from "./api_request_handler";
import {ApiResponse} from "./apiTypes";
import {NoopLogger} from "./logger";
import {books} from "./books";
import {writeJson} from "./util/json_files";
import {PromiseChain} from "./js/promises";
import {cachedOutputFilePath} from "./cached_outputs";
import {RealRequestMaker} from "./request_makers";

const requestHandler = new ApiRequestHandler(new RealRequestMaker(), new NoopLogger());

function makeRequest(bookName: string, section: string): Promise<ApiResponse> {
  return requestHandler.handleRequest(bookName, section)
    .catch(e => {
      console.error(`Error processing ${bookName} ${section}`);
      console.error(e);
      return makeRequest(bookName, section);
    });
}

const promiseChains: PromiseChain[] = [];
for (let i = 0; i < 30; i++) {
  promiseChains[i] = new PromiseChain();
}

let i = 0;
for (const book of Array.from(new Set(Object.values(books.byCanonicalName)))) {
  for (const section of Array.from(book.sections)) {
    const filePath = cachedOutputFilePath(book, section);
    if (fs.existsSync(filePath)) continue;
    const promiseChain = promiseChains[i % promiseChains.length];
    promiseChain.add(
      () => makeRequest(book.canonicalName, section).then(result => writeJson(filePath, result)));
    promiseChain.add(() => console.log(`Finished ${book.canonicalName} ${section}`));
    i++;
  }
}

for (let j = 0; j < promiseChains.length; j++) {
  promiseChains[j].add(() => console.log(`Finished chain #${j}!`));
}
