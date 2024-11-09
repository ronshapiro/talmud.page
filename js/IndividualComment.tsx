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
}: {
  hebrew: string;
  english: string;
  comment: ApiComment;
  commentaryKind: CommentaryType;
  extraClasses?: string[];
  overrideRef?: string;
}): React.ReactElement {
  const [englishSteinsaltzWithHebrew, setEnglishSteinsaltzWithHebrew] = useState(false);
  const toggleEnglishSteinsaltzWithHebrew = (
    () => setEnglishSteinsaltzWithHebrew(old => !old));
  const context = useConfiguration();

  const ref = overrideRef ?? comment.ref;

  const expandableTranslations = (
    context.translationOption() === "both"
      && localStorage.hideGemaraTranslationByDefault === "true"
      && commentaryKind.englishName === "Translation");

  const classes = extraClasses || [];
  classes.push("commentaryRow", "IndividualComment", /* used in CSS */ commentaryKind.className);

  const createRow = (key: string, _hebrew: string, _english: string) => (
    <TableRow
      key={key}
      hebrew={_hebrew}
      english={_english}
      sefaria-ref={ref}
      link={comment.link} // eslint-disable-line react/prop-types
      classes={classes}
      expandEnglishByDefault={
        // eslint-disable-next-line react/prop-types
        commentaryKind.englishName === "Translation" && context.expandEnglishByDefault()
      }
      hebrewDoubleClickListener={
        expandableTranslations
          ? () => toggleEnglishSteinsaltzWithHebrew()
          : undefined
      }
    />
  );

  return (
    <>
      {createRow("main", hebrew, expandableTranslations ? "" : english)}
      {expandableTranslations && englishSteinsaltzWithHebrew
       && createRow("main-translation", "", english)}
    </>
  );
}
InternalTableRow.propTypes = {
  hebrew: PropTypes.string.isRequired,
  english: PropTypes.string.isRequired,
  comment: PropTypes.object.isRequired,
  commentaryKind: PropTypes.object.isRequired,
  extraClasses: PropTypes.arrayOf(PropTypes.string),
  overrideRef: PropTypes.string,
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

function ExpandContextButtonRow({onClick}: {onClick: () => void;}): React.ReactElement {
  const onKeyUp = (event?: React.KeyboardEvent) => {
    if (event && event.code === "Enter") {
      onClick();
    }
  };

  const button = (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <a
      className="commentary_header expandedContext"
      role="button"
      tabIndex={0}
      onClick={() => onClick()}
      onKeyUp={() => onKeyUp()}
    >
      כל הפסקה
    </a>
  );
  // TODO: this may be awkward down the road if we want to apply special styles/indent to nested
  // buttons. It also could potentially be complicated with keyboard shortcuts. Consider trying to
  // instead shoehorn this into CommentariesBlock.
  return <TableRow hebrew={button} classes={["expandedContext", "commentaryRow"]} />;
}

export function IndividualComment({
  comment,
  commentaryKind,
}: {
  comment: ApiComment;
  commentaryKind: CommentaryType;
}): React.ReactElement {
  const output = [];
  const [showCompleteContext, setShowCompleteContext] = useState(
    comment.originalRefsBeforeRewriting === undefined);

  if (commentaryKind.showTitle) {
    const titleRow = (
      <InternalTableRow
        hebrew={comment.sourceHeRef}
        english={isEmptyText(comment.en) ? "" : comment.sourceRef}
        comment={comment}
        commentaryKind={commentaryKind}
        />);
    output.push(<strong key="title">{titleRow}</strong>);
  }

  if (Array.isArray(comment.he) && Array.isArray(comment.en)
    && comment.he.length === comment.en.length
    // Make sure that if there are nested arrays, the flattened length also matches. This is a
    // lazy-person JaggedArray size check.
    && comment.he.flat(Infinity).length === comment.en.flat(Infinity).length) {
    const hebrew = comment.he.flat(Infinity);
    const english = comment.en.flat(Infinity);
    for (let i = 0; i < hebrew.length; i++) {
      const lineRef = (() => {
        if (comment.expandedRefsAfterRewriting) return comment.expandedRefsAfterRewriting[i];
        if (commentaryKind.nestedRefSpacer) {
          return `${comment.ref}${commentaryKind.nestedRefSpacer}${i + 1}`;
        }
        return "ignore-drive";
      })();

      if (!showCompleteContext
        && !comment.originalRefsBeforeRewriting?.includes(lineRef)) {
        continue;
      }

      const isDirectlyReferenced = (
        showCompleteContext && comment.originalRefsBeforeRewriting?.includes(lineRef));

      output.push(
        <InternalTableRow
          key={i}
          hebrew={hebrew[i]}
          english={english[i]}
          overrideRef={lineRef}
          extraClasses={isDirectlyReferenced ? ["directlyReferencedLine"] : []}
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
        />);
  }

  if (comment.originalRefsBeforeRewriting) {
    const onClick = () => setShowCompleteContext(!showCompleteContext);
    output.push(<ExpandContextButtonRow key="Expanded context" onClick={() => onClick()} />);
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

  return <>{output}</>;
}
IndividualComment.propTypes = {
  comment: PropTypes.object.isRequired,
  commentaryKind: PropTypes.object.isRequired,
};
