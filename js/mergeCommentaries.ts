import {CommentaryMap, Section} from "../apiTypes";

const nonEmpty = (x: string) => x !== undefined && x !== "";

export function mergeCommentaries(sections: Section[]): CommentaryMap | undefined {
  let merged: CommentaryMap | undefined;
  for (const section of sections) {
    if (section.commentary) {
      merged = merged || {};
      for (const [name, commentary] of Object.entries(section.commentary)) {
        merged![name] = merged![name] || {comments: []};
        merged![name].comments.push(...commentary.comments);
      }
    }
  }
  if (!merged) return undefined;

  for (const key of ["Translation", "Steinsaltz"]) {
    if (!merged[key]) continue;
    const mergedComment = {...merged[key].comments[0]};
    const hebrews = [];
    const englishes = [];
    for (const comment of merged[key].comments) {
      hebrews.push(comment.he as string);
      englishes.push(comment.en as string);
    }
    mergedComment.he = hebrews.filter(nonEmpty).join(" ");
    mergedComment.en = englishes.filter(nonEmpty).join(" ");

    merged[key]!.comments = [mergedComment];
  }
  return merged;
}
