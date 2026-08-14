import {DriveClient} from "./google_drive/client";
import {UiPage} from "./Page";

/**
 * A local segmentation override (precomputed/segmentation_overrides.ts) can split/merge a
 * segment/comment ref that a user previously saved a personal note or highlight against — the
 * note/highlight isn't lost (it's still in their Google Doc), but it silently stops rendering,
 * since the usual ref-keyed lookup (js/addDriveComments.ts) no longer finds it under the old ref.
 * This is deliberately not fixed here (no old-ref-to-new-ref remapping) — it's surfaced instead,
 * via the caller showing a warning for whatever this returns.
 */
export function findReplacedRefsWithPersonalContent(
  amud: UiPage, driveClient: DriveClient,
): string[] {
  return (amud.replacedRefs ?? []).filter(ref => {
    const hasComments = (driveClient.commentsForRef(ref)?.comments.length ?? 0) > 0;
    const hasHighlights = driveClient.highlightsForRef(ref).length > 0;
    return hasComments || hasHighlights;
  });
}
