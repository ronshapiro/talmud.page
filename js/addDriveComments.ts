import {Amud, Commentary, Section, ApiComment} from "../apiTypes";
import {applyHighlight} from "./highlight";
import {DriveClient} from "./google_drive/client";

function setPersonalComments(obj: Section | ApiComment, personalNotes: Commentary | undefined) {
  if (personalNotes) {
    if (!obj.commentary) obj.commentary = {};
    obj.commentary["Personal Notes"] = personalNotes;
  } else if (obj.commentary) {
    delete obj.commentary["Personal Notes"];
  }
}

function setHighlights(obj: Section | ApiComment, driveClient: DriveClient) {
  if (obj.unhighlighted) {
    Object.assign(obj, obj.unhighlighted);
    delete obj.unhighlighted;
  }
  delete obj.highlightColors;

  const highlights = driveClient.highlightsForRef(obj.ref);
  if (highlights.length > 0) {
    obj.unhighlighted = {he: obj.he, en: obj.en};
    obj.highlightColors = new Set();
    for (const highlight of highlights) {
      const prop = highlight.commentSourceMetadata.isEnglish ? "en" : "he";
      const highlighted = applyHighlight(highlight, obj[prop]);
      if (highlighted) {
        obj[prop] = highlighted;
        obj.highlightColors.add(highlight.highlight);
      }
      // TODO: if the highlight doesn't apply, display an error or add a synthetic comment
    }
  }
}

function setAll(obj: Section | ApiComment, driveClient: DriveClient) {
  setPersonalComments(obj, driveClient.commentsForRef(obj.ref));
  setHighlights(obj, driveClient);

  for (const comment of Object.values(obj?.commentary || {}).flatMap(x => x.comments)) {
    setAll(comment, driveClient);
  }
}

// TODO: tests here would be great
export function addDriveComments(amudim: Amud[], driveClient: DriveClient | undefined): Amud[] {
  if (!driveClient) {
    return amudim;
  }

  for (const section of amudim.flatMap(amud => amud.sections)) {
    setAll(section, driveClient);
  }

  return amudim;
}
