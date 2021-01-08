import {Amud, Commentary, Section, ApiComment} from "../apiTypes";
import {applyHighlight} from "./highlight";
import {DriveClient} from "./google_drive/client";

function setPersonalComments(obj: Section | Commentary, personalNotes: Commentary | undefined) {
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
  delete obj.hasHighlights;

  const highlights = driveClient.highlightsForRef(obj.ref);
  if (highlights.length) {
    obj.unhighlighted = {he: obj.he, en: obj.en};
    for (const highlight of highlights) {
      const prop = highlight.commentSourceMetadata.isEnglish ? "en" : "he";
      const highlighted = applyHighlight(highlight, obj[prop]);
      if (highlighted) {
        obj[prop] = highlighted;
        obj.hasHighlights = true;
      }
      // TODO: if the highlight doesn't apply, display an error or add a synthetic comment
    }
  }
}

function personalCommentsForRefs(refs: string[], driveClient: DriveClient): Commentary | undefined {
  const unflattened = refs.map(ref => driveClient.commentsForRef(ref)).filter(x => x);
  const flattened = [];
  for (const comment of unflattened) {
    flattened.push(...comment!.comments);
  }
  return flattened.length > 0 ? {comments: flattened} : undefined;
}

function setCommentaryPersonalCommentsAndHighlights(
  commentary: Commentary,
  driveClient: DriveClient,
) {
  setPersonalComments(
    commentary,
    personalCommentsForRefs(commentary.comments.map(comment => comment.ref), driveClient));
  commentary.comments.forEach(comment => setHighlights(comment, driveClient));
}

// TODO: tests here would be great
export function addDriveComments(amudim: Amud[], driveClient: DriveClient | undefined): Amud[] {
  if (!driveClient) {
    return amudim;
  }

  for (const section of amudim.flatMap(amud => amud.sections)) {
    setPersonalComments(section, driveClient.commentsForRef(section.ref));
    setHighlights(section, driveClient);

    for (const commentary of Object.values(section.commentary || {}) as Commentary[]) {
      setCommentaryPersonalCommentsAndHighlights(commentary, driveClient);
      for (const nestedCommentary of Object.values(commentary.commentary || {}) as Commentary[]) {
        setCommentaryPersonalCommentsAndHighlights(nestedCommentary, driveClient);
      }
    }
  }

  return amudim;
}
