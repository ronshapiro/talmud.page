import * as React from "react";
import * as PropTypes from "prop-types";
import isEmptyText from "./is_empty_text";
import {useConfiguration} from "./context";
import TableRow from "./TableRow";
import {ApiComment} from "../apiTypes";
import {CommentaryType} from "../commentaries";
import {postCorrection} from "./corrections";
import {useHtmlRef} from "./hooks";
import {flatten} from "../sefariaTextType";
import componentHandler from "./componentHandler";
import {
  hideGemaraTranslationByDefaultPreference,
  rashiTosafotHebrewOption,
} from "./settings";
import {formatRashiTosafotHebrew} from "./rashi_tosafot_formatting";
import {RsiReviewControls} from "./RsiReviewControls";
import {DoubleClickHintSurfaceType} from "./DoubleClickVisualHint";

const {
  useEffect,
  useState,
} = React;

function stringOrListToString(stringOrList: string | string[]): string {
  return typeof stringOrList === "string"
    ? stringOrList
    : stringOrList.join("<br>");
}

function InternalTableRow({
  hebrew,
  english,
  comment,
  commentaryKind,
  extraClasses,
  overrideRef,
  toggleExplanation,
}: {
  hebrew?: string | React.ReactElement;
  english?: string;
  comment: ApiComment;
  commentaryKind: CommentaryType;
  extraClasses?: string[];
  overrideRef?: string;
  toggleExplanation?: () => unknown;
}): React.ReactElement {
  const [englishSteinsaltzWithHebrew, setEnglishSteinsaltzWithHebrew] = useState(false);
  const toggleEnglishSteinsaltzWithHebrew = (
    () => setEnglishSteinsaltzWithHebrew(old => !old));

  const context = useConfiguration();
  if (commentaryKind.englishName === "Vilna Shas") {
    english = undefined;
  }

  const ref = overrideRef ?? comment.ref;

  const expandableTranslations = (
    context.translationOption() === "both"
      && hideGemaraTranslationByDefaultPreference.get() === "true"
      && commentaryKind.englishName === "Translation");

  let renderedHebrew: string | React.ReactElement | undefined = hebrew;
  const isRashiOrTosafot = (
    commentaryKind.englishName === "Rashi" || commentaryKind.englishName === "Tosafot"
  );
  if (isRashiOrTosafot) {
    renderedHebrew = formatRashiTosafotHebrew({
      rawHebrew: hebrew as string,
      originalHebrew: comment.originalHebrew as string,
      option: rashiTosafotHebrewOption(),
    });
  }

  const classes = extraClasses || [];
  classes.push(
    "commentaryRow", "IndividualComment",
    // Used in CSS and ref_selection_snackbar.js
    commentaryKind.className.replace(/ /g, "_"));

  const hebrewDoubleClickListener = (() => {
    if (expandableTranslations) return () => toggleEnglishSteinsaltzWithHebrew();
    if (comment.commentary?.Explanation) return toggleExplanation;
    return undefined;
  })();

  const createRow = (
    key: string,
    _hebrew: string | React.ReactElement | undefined,
    _english: string | undefined,
    doubleClickListener?: () => void,
  ) => (
    <TableRow
      key={key}
      hebrew={_hebrew as any}
      english={_english}
      sefaria-ref={ref}
      link={comment.link} // eslint-disable-line react/prop-types
      classes={classes}
      expandEnglishByDefault={
        // eslint-disable-next-line react/prop-types
        commentaryKind.englishName === "Translation" && context.expandEnglishByDefault()
      }
      hebrewDoubleClickListener={doubleClickListener}
      doubleClickHintSurfaceType={
        commentaryKind.englishName === "Rashi" && comment.commentary?.Explanation && toggleExplanation
          ? DoubleClickHintSurfaceType.RASHI_EXPLANATION
          : undefined
      }
    />
  );

  return (
    <>
      {createRow(
        "main",
        renderedHebrew,
        expandableTranslations ? "" : english,
        hebrewDoubleClickListener,
      )}
      {expandableTranslations && englishSteinsaltzWithHebrew
       && createRow("main-translation", "", english)}
    </>
  );
}
InternalTableRow.propTypes = {
  hebrew: PropTypes.oneOfType([PropTypes.string, PropTypes.element]),
  english: PropTypes.string,
  comment: PropTypes.object.isRequired,
  commentaryKind: PropTypes.object.isRequired,
  extraClasses: PropTypes.arrayOf(PropTypes.string),
  overrideRef: PropTypes.string,
  toggleExplanation: PropTypes.func,
};


const BUTTON_CLASSES = "mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent";
function ReportDuplicateButton({
  comment,
  buttonRef,
}: {
  comment: ApiComment,
  buttonRef: React.MutableRefObject<HTMLButtonElement>,
}): React.ReactElement {
  const onClick = () => postCorrection({
    ref: comment.ref,
    hebrew: flatten(comment.he),
    hebrewHighlighted: undefined,
    translation: flatten(comment.en),
    translationHighlighted: undefined,
    pathname: window.location.pathname,
    userText: `Duplicate of ${comment.duplicateRefs!.join(", ")}`,
    isAiEdit: false,
  });
  const buttonText = `לדווח כפילויות: ${comment.duplicateRefs!.join(", ")}`;
  return (
    <TableRow
      key="report duplicate"
      hebrew={
        <button ref={buttonRef} className={BUTTON_CLASSES} onClick={onClick}>{buttonText}</button>
      }
      classes={["commentaryRow"]} />
  );
}

export function IndividualComment({
  comment,
  commentaryKind,
  parentComment,
  toggleExplanation,
}: {
  comment: ApiComment;
  commentaryKind: CommentaryType;
  parentComment?: ApiComment;
  toggleExplanation?: () => unknown;
}): React.ReactElement {
  const output = [];

  if (commentaryKind.showTitle) {
    const includeEnglishTitle = (
      !isEmptyText(comment.en)
        || (comment.rows ?? []).filter(row => !isEmptyText(row.english)).length > 0
    );
    const titleRow = (
      <InternalTableRow
        hebrew={comment.sourceHeRef}
        english={includeEnglishTitle ? comment.sourceRef : ""}
        comment={comment}
        commentaryKind={commentaryKind}
        />);
    output.push(<strong key="title">{titleRow}</strong>);
  }

  const getLineRef = (i: number) => {
    if (comment.expandedRefsAfterRewriting) return comment.expandedRefsAfterRewriting[i];
    if (commentaryKind.nestedRefSpacer) {
      return `${comment.ref}${commentaryKind.nestedRefSpacer}${i + 1}`;
    }
    return "ignore-drive";
  };

  const isAiModified = Boolean(comment.didModifyUiWithAiVersion);
  const aiHebrew = isAiModified && (comment.aiModifiedHebrew ?? !comment.aiModifiedEnglish);
  const aiEnglish = isAiModified && (comment.aiModifiedEnglish ?? !comment.aiModifiedHebrew);

  const extraClasses = [
    ...(isAiModified ? ["ai-modified"] : []),
    ...(aiHebrew ? ["ai-modified-hebrew"] : []),
    ...(aiEnglish ? ["ai-modified-english"] : []),
    ...(comment.recentlySplit ? ["recently-split"] : []),
    ...(comment.pendingReview ? ["pending-review"] : []),
  ];

  if (comment.rows) {
    let i = 0;
    for (const row of comment.rows) {
      const lineRef = row.ref ?? getLineRef(i);
      if (row.image) {
        output.push(
          <InternalTableRow
            key={`image-${i}`}
            hebrew={row.image}
            overrideRef={`${lineRef}-image`}
            comment={comment}
            commentaryKind={commentaryKind}
            extraClasses={["commentFullRowImage"]}
            />);
      }
      if (row.hebrew || row.english) {
        const isDirectlyReferenced = (
          comment.originalRefsBeforeRewriting?.includes(lineRef));

        output.push(
          <InternalTableRow
            key={`text-${i}`}
            hebrew={row.hebrew}
            english={row.english}
            overrideRef={lineRef}
            extraClasses={
              extraClasses.concat(isDirectlyReferenced ? ["directlyReferencedLine"] : [])
            }
            comment={comment}
            commentaryKind={commentaryKind}
            />);
        i++;
      }
    }
  } else if (Array.isArray(comment.he) && Array.isArray(comment.en)
    && comment.he.length === comment.en.length
    // Make sure that if there are nested arrays, the flattened length also matches. This is a
    // lazy-person JaggedArray size check.
    && comment.he.flat(Infinity).length === comment.en.flat(Infinity).length) {
    const hebrew = comment.he.flat(Infinity);
    const english = comment.en.flat(Infinity);
    for (let i = 0; i < hebrew.length; i++) {
      const lineRef = getLineRef(i);
      const isDirectlyReferenced = (
        comment.originalRefsBeforeRewriting?.includes(lineRef));

      output.push(
        <InternalTableRow
          key={i}
          hebrew={hebrew[i]}
          english={english[i]}
          overrideRef={lineRef}
          extraClasses={extraClasses.concat(isDirectlyReferenced ? ["directlyReferencedLine"] : [])}
          comment={comment}
          commentaryKind={commentaryKind}
          />);
    }
  } else {
    output.push(
      <InternalTableRow
        key="joined comments"
        hebrew={stringOrListToString(comment.he)}
        english={stringOrListToString(comment.en)}
        comment={comment}
        commentaryKind={commentaryKind}
        extraClasses={extraClasses}
        toggleExplanation={toggleExplanation}
        />);
  }

  const buttonRef = useHtmlRef<HTMLButtonElement>();
  useEffect(() => {
    if (buttonRef.current) {
      componentHandler.upgradeElement(buttonRef.current);
    }
  });
  if ((comment.duplicateRefs?.length ?? 0) > 0) {
    output.push(<ReportDuplicateButton key="dupe" comment={comment} buttonRef={buttonRef} />);
  }
  if (parentComment?.pendingReview && commentaryKind.englishName === "Model") {
    output.push(<RsiReviewControls key="rsi-review" comment={parentComment} />);
  } else if (comment.pendingReview && !comment.commentary?.Model) {
    output.push(<RsiReviewControls key="rsi-review" comment={comment} />);
  }

  return <>{output}</>;
}
IndividualComment.propTypes = {
  comment: PropTypes.object.isRequired,
  commentaryKind: PropTypes.object.isRequired,
  parentComment: PropTypes.object,
  toggleExplanation: PropTypes.func,
};
