import * as React from "react";
import * as PropTypes from "prop-types";
import isEmptyText from "./is_empty_text";
import {useConfiguration} from "./context";
import TableRow from "./TableRow";

const {
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
  comment: any;
  commentaryKind: any;
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

export function IndividualComment({
  comment,
  commentaryKind,
}: {
  comment: any;
  commentaryKind: any;
}): React.ReactElement {
  const output = [];
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
        if (comment.expandedRefPrefix) return `${comment.expandedRefPrefix} ${i + 1}`;
        return "ignore-drive";
      })();

      output.push(
        <InternalTableRow
          key={i}
          hebrew={hebrew[i]}
          english={english[i]}
          overrideRef={lineRef}
          extraClasses={
            comment.originalRefsBeforeRewriting?.includes(lineRef) ? ["directlyReferencedLine"] : []
          }
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

  return <>{output}</>;
}
IndividualComment.propTypes = {
  comment: PropTypes.object.isRequired,
  commentaryKind: PropTypes.object.isRequired,
};
