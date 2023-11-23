/* eslint-disable no-console */
import * as chalk from 'chalk';
import {DateTime} from "luxon";
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

let lastTime: DateTime = DateTime.now();
let responseCounter = 0;
const times: number[] = [];

function meanTime(): string {
  if (times.length === 1) return "";
  let sum = 0;
  const sliced = times.slice(-10);
  for (const value of sliced) sum += value;
  const mean = sum / sliced.length;
  return chalk.bgBlue.black(("Avg: " + mean + "").slice(0, 12));
}

function reportFinish() {
  responseCounter += 1;
  if (responseCounter % 10 === 0) {
    const newTime = DateTime.now();
    const durationSeconds = newTime.diff(lastTime).as("seconds");
    times.push(durationSeconds);
    console.log(chalk.bgGreen.black((durationSeconds + "").padEnd(6)), meanTime());
    lastTime = newTime;
  }
}

function makeRequest(bookName: string, section: string): Promise<ApiResponse> {
  return requestHandler.handleRequest(bookName, section)
    .catch(e => {
      console.error(`Error processing ${bookName} ${section}`);
      console.error(e);
      return makeRequest(bookName, section);
    });
}

const promiseChains: PromiseChain[] = [];
for (let i = 0; i < 100; i++) {
  promiseChains[i] = new PromiseChain();
}

let i = 0;
for (const book of Array.from(new Set(Object.values(books.byCanonicalName)))) {
  if (book.canonicalName === "Shekalim") continue;
  for (const section of Array.from(book.sections)) {
    const filePath = cachedOutputFilePath(book, section);
    if (fs.existsSync(filePath)) continue;
    const promiseChain = promiseChains[i % promiseChains.length];
    promiseChain.add(() => {
      const response = makeRequest(book.canonicalName, section);
      response.then(result => writeJson(filePath, result));
      response.then(reportFinish);
      return response;
    });
    promiseChain.add(() => console.log(`Finished ${book.canonicalName} ${section}`));
    i++;
  }
}

for (let j = 0; j < promiseChains.length; j++) {
  promiseChains[j].add(() => console.log(`Finished chain #${j}!`));
}
