import {CommentaryType, MASTER_COMMENTARY_TYPES} from "./commentaries";
import {checkNotUndefined} from "./undefined";

const STEINSALTZ = (
  checkNotUndefined(
    MASTER_COMMENTARY_TYPES.find(x => x.englishName === "Steinsaltz"),
    "steinsaltz"));
const COMMENTARY_TYPES = MASTER_COMMENTARY_TYPES.filter(x => x.englishName !== "Steinsaltz");

export function getCommentaryTypes(resourceType: "tanakh" | "talmud"): CommentaryType[] {
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
