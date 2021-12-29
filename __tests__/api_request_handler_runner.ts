import {exec} from "child_process";
import {ArgumentParser} from "argparse";
import {writeJson} from "../util/json_files";
import {ApiRequestHandler} from "../api_request_handler";
import {RecordingRequestMaker, testPages} from "./api_request_handler_base";

const argParser = new ArgumentParser({description: "Update api_request_handler test files"});
argParser.add_argument('--title');
argParser.add_argument('--page');
const flags = argParser.parse_args();

if (!flags.title && !flags.page) {
  exec("rm test_data/api_request_handler/*");
}

const requestHandler = new ApiRequestHandler(new RecordingRequestMaker());
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
