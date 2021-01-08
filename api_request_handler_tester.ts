import {ApiRequestHandler} from "./api_request_handler";

new ApiRequestHandler(new RealRequestMaker()).handleRequest("Shabbat", "2a")
  .then(x => {
    // do not submit
    for (const section of x.sections) {
      console.log(section.ref, section.commentary);
    }
  });
