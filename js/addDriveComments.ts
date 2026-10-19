import {zip} from "underscore";
import {Section, ApiComment} from "../apiTypes";
import {applyHighlight} from "./highlight";
import {DriveClient} from "./google_drive/client";
import {toFlatArray} from "../sefariaTextType";
import {HighlightColor} from "./google_drive/types";
import {UiPage} from "./Page";

function setPersonalComments(obj: Section | ApiComment, driveClient: DriveClient) {
  const personalNotes = (() => {
    if ("expandedRefsAfterRewriting" in obj) {
      const comments = [];
      for (const ref of obj.expandedRefsAfterRewriting!) {
        comments.push(...driveClient.commentsForRef(ref)?.comments ?? []);
      }
      if (comments.length === 0) return undefined;
      return {comments};
    }
    return driveClient.commentsForRef(obj.ref);
  })();

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

  const unhighlighted = {he: obj.he, en: obj.en};

  if ("expandedRefsAfterRewriting" in obj) {
    const highlightColors = new Set<HighlightColor>();
    const newHe: sefaria.TextType = [];
    const newEn: sefaria.TextType = [];
    for (const [ref, he, en] of zip(
      obj.expandedRefsAfterRewriting!,
      toFlatArray(obj.he) as string[],
      toFlatArray(obj.en) as string[])) {
      const synthetic: Section = {he, en, ref};
      setHighlights(synthetic, driveClient);
      newHe.push(synthetic.he as string);
      newEn.push(synthetic.en as string);
      for (const color of (synthetic.highlightColors || [])) {
        highlightColors.add(color);
      }
    }
    if (highlightColors.size > 0) {
      obj.he = newHe;
      obj.en = newEn;
      obj.unhighlighted = unhighlighted;
      obj.highlightColors = highlightColors;
    }
  } else {
    const highlights = driveClient.highlightsForRef(obj.ref);
    if (highlights.length > 0) {
      obj.unhighlighted = unhighlighted;
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
}

function setAll(obj: Section | ApiComment, driveClient: DriveClient) {
  setPersonalComments(obj, driveClient);
  setHighlights(obj, driveClient);

  for (const comment of Object.values(obj?.commentary || {}).flatMap(x => x.comments)) {
    setAll(comment, driveClient);
  }
}

// TODO: tests here would be great
export function addDriveComments(amudim: UiPage[], driveClient: DriveClient | undefined): UiPage[] {
  if (!driveClient) {
    return amudim;
  }

  for (const section of amudim.flatMap(amud => amud.sections)) {
    setAll(section, driveClient);
  }

  return amudim;
}
