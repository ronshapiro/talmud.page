import {AbstractApiRequestHandler, InternalSegment, RealRequestMaker} from "./api_request_handler";
import {Logger} from "./logger";
import {sefariaTextTypeTransformation} from "./sefariaTextType";
import {writeJson} from "./util/json_files";

const englishTransform = sefariaTextTypeTransformation(
  text => text.replace(/ \[fill in the name of the tractate\]/g, ""));

const hebrewTransform = sefariaTextTypeTransformation(
  text => text
    .replace(/וְצֶאֱצָאֵינוּ/g, "וְצֶאֱצָאֵינוּ (וְצֶאֱצָאֵי צֶאֱצָאֵינוּ)")
    .replace(/-/g, " ")
    .replace(/ {2}/g, " "));

class HadranRequestHandler extends AbstractApiRequestHandler {
  protected recreateWithLogger(logger: Logger): AbstractApiRequestHandler {
    return new HadranRequestHandler(this.requestMaker, logger);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected makeId(bookName: string, page: string): string {
    return "Hadran";
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected makeTitle(bookName: string, page: string): string {
    return "Hadran";
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected makeSubRef(mainRef: string, index: number): string {
    return `Hadran ${index + 1}`;
  }

  protected postProcessSegment(segment: InternalSegment): InternalSegment {
    segment.hebrew = hebrewTransform(segment.hebrew);
    segment.english = englishTransform(segment.english);
    return segment;
  }
}

new HadranRequestHandler(new RealRequestMaker()).handleRequest("Hadran", "")
  .then(response => writeJson("precomputed_texts/hadran.json", response));
