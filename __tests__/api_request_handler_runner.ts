import {writeJson} from "../util/json_files";
import {ApiRequestHandler} from "../api_request_handler";
import {RecordingRequestMaker, testPages} from "./api_request_handler_base";

const requestHandler = new ApiRequestHandler(new RecordingRequestMaker());
for (const testPage of testPages) {
  requestHandler.handleRequest(testPage.title, testPage.page)
    .then(results => writeJson(testPage.outputFilePath(), results));
}
