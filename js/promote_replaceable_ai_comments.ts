import {UiPage} from "./Page";
import {
  CommentaryMap,
  Section,
  ApiComment,
} from "../apiTypes";
import {AI_EDIT_COMMENT_NAME} from "./commentary_constants";
import isEmptyText from "./is_empty_text";

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
        if (!isEmptyText(aiCommentCopy.en)) {
          comment.en = aiCommentCopy.en;
        }
        comment.didModifyUiWithAiVersion = true;
        comment.aiModifiedHebrew = true;
        comment.aiModifiedEnglish = !isEmptyText(aiCommentCopy.en);
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
      } else if (aiComment && isEmptyText(aiComment.he) && !isEmptyText(aiComment.en)) {
        const aiCommentCopy = {...aiComment};
        if (!isEmptyText(comment.en)) {
          // If the original comment already had English, preserve it in Original Text
          const originalTextComment = aiComment;
          originalTextComment.he = comment.he;
          originalTextComment.en = comment.en;
          originalTextComment.sourceRef = "Original Text";
          originalTextComment.sourceHeRef = "מקורי";
          if (originalTextComment.commentary) {
            delete originalTextComment.commentary.Model;
            if (Object.keys(originalTextComment.commentary).length === 0) {
              delete originalTextComment.commentary;
            }
          }
          delete originalTextComment.pendingReview;
        } else {
          // Remove the AI version from Versions since it has been fully inlined and nothing is
          // displaced.
          const versions = comment.commentary!.Versions!;
          versions.comments = versions.comments.filter(c => c !== aiComment);
          if (versions.comments.length === 0) {
            delete comment.commentary!.Versions;
          }
        }

        comment.en = aiCommentCopy.en;
        comment.didModifyUiWithAiVersion = true;
        comment.aiModifiedHebrew = false;
        comment.aiModifiedEnglish = true;
        if (aiCommentCopy.pendingReview) {
          comment.pendingReview = aiCommentCopy.pendingReview;
        }
        if (aiCommentCopy.commentary?.Model) {
          comment.commentary = comment.commentary || {};
          comment.commentary.Model = aiCommentCopy.commentary.Model;
        }
        if (comment.commentary && Object.keys(comment.commentary).length === 0) {
          delete comment.commentary;
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
