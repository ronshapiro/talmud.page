/* eslint-disable no-console */
import {ApiRequestHandler, ApiException, RealRequestMaker} from "./api_request_handler";
import {ApiResponse} from "./apiTypes";
import {NoopLogger} from "./logger";
import {books} from "./books";
import {writeJson} from "./util/json_files";
import {PromiseChain} from "./js/promises";

const requestHandler = new ApiRequestHandler(new RealRequestMaker());

function makeRequest(bookName: string, section: string): Promise<ApiResponse> {
  return requestHandler.handleRequest(bookName, section, new NoopLogger())
    .catch(e => {
      if (e instanceof ApiException) {
        console.error(`ApiException in ${bookName} ${section}`);
      }
      console.error(e);
      return makeRequest(bookName, section);
    });
}

const promiseChain = new PromiseChain();

for (const book of Array.from(new Set(Object.values(books.byCanonicalName)))) {
  for (const section of Array.from(book.sections)) {
    const filePath = `cached_outputs/api_request_handler/${book.canonicalName}.${section}.json`;
    promiseChain.add(
      () => makeRequest(book.canonicalName, section).then(result => writeJson(filePath, result)));
    promiseChain.add(() => console.log(`Finished ${book.canonicalName} ${section}`));
  }
}
promiseChain.add(() => console.log("Finished!"));
