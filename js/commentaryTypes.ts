import {CommentaryType, ALL_COMMENTARIES} from "../commentaries";
import {checkNotUndefined} from "./undefined";

const STEINSALTZ = (
  checkNotUndefined(
    ALL_COMMENTARIES.find(x => x.englishName === "Steinsaltz"),
    "steinsaltz"));
const COMMENTARY_TYPES = ALL_COMMENTARIES.filter(x => x.englishName !== "Steinsaltz");

export function getCommentaryTypes(
  resourceType: "siddur" | "tanakh" | "talmud" | "mishna",
): CommentaryType[] {
  const types = [...COMMENTARY_TYPES];
  if (resourceType === "talmud") {
    if (localStorage.showTranslationButton === "yes") {
      types.push(STEINSALTZ);
    } else {
      types.unshift(STEINSALTZ);
    }
  }
  types.push({
    englishName: "Personal Notes",
    hebrewName: "Personal Notes",
    className: "personal-notes",
  });

  return types;
}
