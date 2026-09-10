import {UiPage} from "./Page";
import {
  CommentaryMap,
  Section,
  ApiComment,
} from "../apiTypes";
import {AI_EDIT_COMMENT_NAME} from "./commentary_constants";

// TODO: if there is only english in the AI and the source has only hebrew, merge them

function getAiVersionComment(parent: Section | ApiComment): ApiComment | undefined {
  for (const comment of parent.commentary?.Versions?.comments ?? []) {
    if (comment.sourceRef === AI_EDIT_COMMENT_NAME) {
      return comment;
    }
  }
  return undefined;
}

function promoteReplaceableAiCommentsForCommentary(commentaryMap: CommentaryMap | undefined) {
  if (!commentaryMap) return;
  for (const commentary of Object.values(commentaryMap ?? {})) {
    for (const comment of commentary.comments) {
      const aiComment = getAiVersionComment(comment);
      if (aiComment?.canReplaceParent) {
        delete aiComment.canReplaceParent;
        // Rename for clarity
        const aiCommentCopy = {...aiComment};
        const originalTextComment = aiComment;
        originalTextComment.he = comment.he;
        originalTextComment.en = comment.en;
        originalTextComment.sourceRef = "Original Text";
        originalTextComment.sourceHeRef = "מקורי";

        comment.he = aiCommentCopy.he;
        comment.en = aiCommentCopy.en;
        comment.didModifyUiWithAiVersion = true;
        if (aiCommentCopy.pendingReview) {
          comment.pendingReview = aiCommentCopy.pendingReview;
          delete originalTextComment.pendingReview;
        }
        if (aiCommentCopy.commentary?.Model) {
          comment.commentary = comment.commentary || {};
          comment.commentary.Model = aiCommentCopy.commentary.Model;
          if (originalTextComment.commentary) {
            delete originalTextComment.commentary.Model;
            if (Object.keys(originalTextComment.commentary).length === 0) {
              delete originalTextComment.commentary;
            }
          }
        }
      }

      promoteReplaceableAiCommentsForCommentary(comment.commentary);
    }
  }
}

export function promoteReplaceableAiComments(page: UiPage): void {
  for (const segment of page.sections) {
    // TODO: promote AI content to segments also:
    /*
    const aiComment = getAiVersionComment(segment);
    if (aiComment?.canReplaceParent) {
      ...
    }
    */
    promoteReplaceableAiCommentsForCommentary(segment.commentary);
  }
}
