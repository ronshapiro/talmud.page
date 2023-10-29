import {AbstractApiRequestHandler, InternalSegment} from "./api_request_handler";
import {NoopLogger} from "./logger";
import {RealRequestMaker} from "./request_makers";
import {sefariaTextTypeTransformation} from "./sefariaTextType";
import {writeJson} from "./util/json_files";

const englishTransform = sefariaTextTypeTransformation(
  text => text.replace(/ \[fill in the name of the tractate]/g, ""));

const hebrewTransform = sefariaTextTypeTransformation(
  text => text
    .replace(/וְצֶאֱצָאֵינוּ/g, "וְצֶאֱצָאֵינוּ (וְצֶאֱצָאֵי צֶאֱצָאֵינוּ)")
    .replace(/-/g, " ")
    .replace(/ {2}/g, " "));

class HadranRequestHandler extends AbstractApiRequestHandler {
  protected makeId(): string {
    return "Hadran";
  }

  protected makeTitle(): string {
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

new HadranRequestHandler("Hadran", "", new RealRequestMaker(), new NoopLogger())
  .handleRequest()
  .then(response => writeJson("precomputed_texts/hadran.json", response));
