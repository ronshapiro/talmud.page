import {exec} from "child_process";
import {writeJson} from "../util/json_files";
import {ApiRequestHandler} from "../api_request_handler";
import {RecordingRequestMaker, testPages} from "./api_request_handler_base";

exec("rm test_data/api_request_handler/*");

const requestHandler = new ApiRequestHandler(new RecordingRequestMaker());
for (const testPage of testPages) {
  requestHandler.handleRequest(testPage.title, testPage.page)
    .then(results => writeJson(testPage.outputFilePath(), results))
    .catch(e => {
      console.error(e);
      process.exit(1); // eslint-disable-line unicorn/no-process-exit
    });
}
