import {exec} from "child_process";
import {ArgumentParser} from "argparse";
import {writeJson} from "../util/json_files";
import {ApiRequestHandler} from "../api_request_handler";
import {FakeRequestMaker, RecordingRequestMaker, TEST_DATA_ROOT} from "../request_makers";
import {testPages} from "./api_request_handler_base";

const argParser = new ArgumentParser({description: "Update api_request_handler test files"});
argParser.add_argument("--title");
argParser.add_argument("--page");
argParser.add_argument("--use_cached_inputs");
const flags = argParser.parse_args();

if (!flags.title && !flags.page && !flags.use_cached_inputs) {
  exec("rm test_data/api_request_handler/*");
}

const requestMaker = (
  flags.use_cached_inputs
    ? new FakeRequestMaker(TEST_DATA_ROOT)
    : new RecordingRequestMaker(TEST_DATA_ROOT));

const requestHandler = new ApiRequestHandler(requestMaker);
for (const testPage of testPages) {
  if (flags.title && flags.title !== testPage.title) continue;
  if (flags.page && flags.page !== testPage.page) continue;
  requestHandler.handleRequest(testPage.title, testPage.page)
    .then(results => writeJson(testPage.outputFilePath(), results))
    .catch(e => {
      console.error(e);
      process.exit(1); // eslint-disable-line unicorn/no-process-exit
    });
}
