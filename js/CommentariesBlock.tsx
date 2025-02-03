/* global gtag */
/* eslint-disable react/jsx-max-props-per-line */
import * as React from "react";
import * as PropTypes from 'prop-types';
import {IndividualComment} from "./IndividualComment";
import TableRow from "./TableRow";
import {useConfiguration} from "./context";
import {ApiComment, Commentary} from "../apiTypes";
import {CommentaryType} from "../commentaries";
import {useHtmlRef} from "./hooks";

const {
  useEffect,
  useState,
} = React;

const JSX_NOOP = null;

function hasNestedPersonalComments(commentary: Commentary): boolean {
  for (const comment of commentary.comments || []) {
    if (!comment.commentary) continue;
    if (comment.commentary["Personal Notes"]) return true;
    for (const nestedCommentary of Object.values(comment.commentary)) {
      if (hasNestedPersonalComments(nestedCommentary)) {
        return true;
      }
    }
  }
  return false;
}

function commentaryHighlightColors(commentary: Commentary, colors?: Set<string>): Set<string> {
  if (!colors) colors = new Set();
  for (const comment of commentary.comments) {
    for (const color of comment.highlightColors || []) {
      colors.add(color);
    }
    Object.values(comment.commentary || {}).forEach(
      nested => commentaryHighlightColors(nested, colors));
  }
  return colors;
}
function commentaryHighlightIndicators(commentary: Commentary): React.ReactElement[] {
  const result = Array.from(commentaryHighlightColors(commentary)).map(
    color => <span key={color} className={`highlighted-commentary-indicator-${color}`}>●</span>);
  return result;
}

function textTypeHasImage(text: sefaria.TextType): boolean {
  if (!text) return false;
  if (typeof text === "string") return text.includes("<img");
  return text.some(x => textTypeHasImage(x));
}

function hasImage(commentary: Commentary): boolean {
  for (const comment of commentary.comments) {
    if (textTypeHasImage(comment.he) || textTypeHasImage(comment.en)) {
      return true;
    }
    if (Object.values(comment.commentary || {}).some(hasImage)) {
      return true;
    }
  }
  return false;
}

function InternalTableRow(
  {hebrew, extraClasses, id}: {
    hebrew: React.ReactElement;
    extraClasses?: string[];
    id: string;
  },
): React.ReactElement {
  const context = useConfiguration();
  return (
    <TableRow
      id={id.replace(/[ .<>:]/g, "__")} // eslint-disable-line unicorn/better-regex
      key={id}
      hebrew={hebrew}
      overrideFullRow={context.translationOption() === "english-side-by-side"}
      classes={["commentaryRow", "GeneralCommentariesBlockRow"].concat(extraClasses ?? [])}
      />
  );
}

const MAX_BUTTONS_TO_SHOW_BEFORE_SHOWING_MORE = 7;
const DEBUG_EXPAND_ALL_COMMENTARIES_BY_DEFAULT = false;

function* dedupeComments(comments: Iterable<ApiComment>): Generator<ApiComment> {
  // This set is particulary useful for merged segments, where duplicates are more common.
  const seen = new Set();
  for (const comment of comments) {
    if (!seen.has(comment.ref)) {
      seen.add(comment.ref);
      yield comment;
    }
  }
}

function syntheticCommentaryKind(commentary: Commentary): CommentaryType {
  const comment = commentary.comments[0];
  return {
    englishName: comment.sourceRef,
    className: comment.sourceRef,
    hebrewName: comment.sourceHeRef,
  };
}

function showMoreCommentaryKind(showAll: boolean): CommentaryType {
  return showAll
    ? {englishName: "Hide", hebrewName: "פחות", className: "show-more"}
    : {englishName: "More", hebrewName: "עוד", className: "show-more"};
}

interface CommentariesBlockProps {
  commentaries: Record<string, Commentary>;
  getOrdering: (segmentLabel: string) => string[];
  toggleShowing: (segmentLabel: string, className: string) => boolean;
  segmentLabel: string;
  syntheticClassName?: string;
  syntheticCommentaryKinds?: Record<string, CommentaryType>;
  depth?: number;
}

export function CommentariesBlock({
  commentaries,
  getOrdering,
  toggleShowing,
  segmentLabel,
  syntheticClassName,
  syntheticCommentaryKinds,
  depth,
}: CommentariesBlockProps): React.ReactElement | null {
  const context = useConfiguration();
  const [showAll, setShowAll] = useState(false);
  const [buttonToFocus, setButtonToFocus] = useState<CommentaryType | undefined>();
  const buttonToFocusAfterEnter = useHtmlRef<HTMLElement>();
  depth = depth ?? 0;

  const forEachCommentary = (action: (commentary: Commentary, kind: CommentaryType) => void) => {
    if (syntheticCommentaryKinds) {
      Object.values(commentaries).forEach(commentary => {
        action(commentary, syntheticCommentaryKind(commentary));
      });
      return;
    }
    for (const commentaryKind of context.commentaryTypes) {
      const commentary = commentaries[commentaryKind.englishName];
      if (commentary) {
        action(commentary, commentaryKind);
      }
    }
  };

  useEffect(() => {
    if (buttonToFocus) {
      buttonToFocusAfterEnter.current.focus();
      setButtonToFocus(undefined);
    }
  }, [buttonToFocus]);

  useEffect(() => {
    if (DEBUG_EXPAND_ALL_COMMENTARIES_BY_DEFAULT) {
      setTimeout(() => {
        forEachCommentary((_, commentaryKind) => {
          toggleShowing(segmentLabel, commentaryKind.className);
        });
      }, 100);
    }
  }, ["only once"]);

  if (!commentaries || Object.keys(commentaries).length === 0) {
    return JSX_NOOP;
  }

  const NestedCommentariesBlock = (
    props: Omit<CommentariesBlockProps, "toggleShowing" | "getOrdering">): React.ReactElement => {
    return <CommentariesBlock
      commentaries={props.commentaries}
      getOrdering={getOrdering}
      toggleShowing={toggleShowing}
      segmentLabel={props.segmentLabel}
      syntheticClassName={props.syntheticClassName}
      syntheticCommentaryKinds={props.syntheticCommentaryKinds}
      depth={depth! + 1}
      />;
  };

  const renderCommentsAsNestedCommentaries = (
    commentary: Commentary, commentaryClassName: string,
  ): React.ReactElement => {
    const commentariesByComment: Record<string, Commentary> = {};
    const kinds: Record<string, CommentaryType> = {};
    for (const comment of commentary.comments) {
      const syntheticCommentary = {comments: [comment]};
      const kind = syntheticCommentaryKind(syntheticCommentary);
      commentariesByComment[kind.englishName] = syntheticCommentary;
      kinds[kind.className] = kind;
    }

    const nestedSegmentLabel = `${segmentLabel}.<inner>.${commentaryClassName}`;
    return (
      <NestedCommentariesBlock
        commentaries={commentariesByComment}
        segmentLabel={nestedSegmentLabel}
        key={nestedSegmentLabel}
        syntheticClassName={commentaryClassName}
        syntheticCommentaryKinds={kinds}
        depth={depth! + 1}
        />);
  };

  const buttonClasses = (
    commentaryKind: CommentaryType, isShowing: boolean, commentary: Commentary): string => {
    return [
      "commentary_header",
      commentaryKind.className,
      commentaryKind.cssCategory,
      !isShowing && hasNestedPersonalComments(commentary)
        ? "has-nested-commentaries"
        : undefined,
      syntheticClassName,
    ].filter(x => x).join(" ");
  };

  const renderButton = (
    commentaryKind: CommentaryType, isShowing: boolean, commentary: Commentary,
  ): React.ReactElement | null => {
    if (localStorage.showTranslationButton !== "yes"
        && commentaryKind.className === "translation") {
      return JSX_NOOP;
    }

    const onClick = () => {
      if (commentaryKind.className === "show-more") {
        setShowAll(previous => !previous);
        return;
      }
      const newValue = toggleShowing(segmentLabel, commentaryKind.className);
      gtag("event", newValue ? "commentary_viewed" : "commentary_hidden", {
        commentary: commentaryKind.englishName,
        section: segmentLabel,
      });
    };
    const onKeyUp = (event?: React.KeyboardEvent) => {
      if (event && event.code === "Enter") {
        onClick();
        setButtonToFocus(commentaryKind);
      }
    };
    const applyButtonToFocusRef = (element: React.ReactElement) => {
      if (buttonToFocus === commentaryKind) {
        (element as any).ref = buttonToFocusAfterEnter;
      }
      return element;
    };

    const depthIndicator = [];
    for (let i = 0; i < depth!; i++) {
      depthIndicator.push(
        <span className={"depthIndicator " + buttonClasses(commentaryKind, isShowing, commentary)}>
          {">"}
        </span>,
      );
    }

    const id = commentaryKind.className + "__" + segmentLabel;
    const button = applyButtonToFocusRef(
      <>
        {depthIndicator}
        {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
        <a
          id={id}
          key="button"
          className={buttonClasses(commentaryKind, isShowing, commentary) + (
            context.selectedCommentaryView?.id === id ? " keybindingSelectedButton" : ""
          )}
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyUp={onKeyUp}>
          {commentaryKind.hebrewName}
        </a>
      </>);
    const highlightColors = !isShowing && commentaryHighlightIndicators(commentary);
    const imageIndicator = !isShowing && hasImage(commentary) && "📸 🖼️";
    return (
      // Wrap in a span so that the commentary colors don't get their own flex spacing separate from
      // the button.
      <span key={commentaryKind.englishName}>{button} {highlightColors} {imageIndicator}</span>
    );
  };

  const renderShowButtons = () => {
    const commentariesToShow: [Commentary, CommentaryType][] = [];
    const openCommentaries = new Set(getOrdering(segmentLabel));
    forEachCommentary((commentary, commentaryKind) => {
      if (commentaryKind.ignoreInHebrew && localStorage.languageOption === "hebrew") return;
      if (!openCommentaries.has(commentaryKind.className)) {
        commentariesToShow.push([commentary, commentaryKind]);
      }
    });

    const buttons = [];
    let wouldAnyButtonBeHidden = false;
    for (const [commentary, commentaryKind] of commentariesToShow) {
      const wouldThisButtonBeHidden = (
        buttons.length > MAX_BUTTONS_TO_SHOW_BEFORE_SHOWING_MORE
          && commentariesToShow.length > (MAX_BUTTONS_TO_SHOW_BEFORE_SHOWING_MORE + 2)
          && commentaryKind.className !== "personal-notes"
          && commentaryHighlightColors(commentary).size === 0);
      wouldAnyButtonBeHidden = wouldAnyButtonBeHidden || wouldThisButtonBeHidden;
      if (showAll || !wouldThisButtonBeHidden) {
        buttons.push(renderButton(commentaryKind, false, commentary));
      }
    }

    if (wouldAnyButtonBeHidden) {
      buttons.push(renderButton(showMoreCommentaryKind(showAll), false, {comments: []}));
    }

    return (
      <InternalTableRow
        id={`${segmentLabel} show buttons`}
        key="show buttons"
        hebrew={<>{buttons.filter(x => x)}</>}
        extraClasses={["show-buttons"]} />
    );
  };

  function* getOpenCommentariesInOrder(
    commentaryKindsByClassName: Record<string, CommentaryType>,
  ): Generator<[Commentary, CommentaryType]> {
    for (const commentaryClassName of getOrdering(segmentLabel)) {
      const commentaryKind = commentaryKindsByClassName[commentaryClassName];
      let commentary = commentaries[commentaryKind.englishName];
      if (!commentary) {
        // TODO: investigate a better solution for the indexByClassName overlapping for Translation
        // and Steinsaltz (it appears when side-by-side is used)
        // TODO: this also causes problems for keyboard shortcuts with an zero-height row for the
        // close button
        if (commentaryClassName === "translation") {
          commentary = commentaries.Steinsaltz;
        }
        if (!commentary) {
          // This can happen when deleting the last personal note in a segment, as the delete
          // happens outside of the normal JS flow.
          if (commentaryClassName === "personal-notes") continue;

          throw new Error(
            `Could not find ${commentaryClassName} commentary in ${segmentLabel}
            ${Object.keys(commentaries).join(", ")}`);
        }
      }
      yield [commentary, commentaryKind];
    }
  }

  // Main:
  const kindsByClassName = syntheticCommentaryKinds || context.commentaryTypesByClassName;

  const output = [];
  for (const [commentary, commentaryKind] of getOpenCommentariesInOrder(
    kindsByClassName)) {
    output.push(
      <InternalTableRow
        id={`${segmentLabel} ${commentaryKind.englishName}`}
        key={commentaryKind.englishName + " close button"}
        hebrew={renderButton(commentaryKind, true, commentary)!} />);

    if (commentaryKind.renderCommentsAsNestedCommentaries && !syntheticCommentaryKinds) {
      output.push(renderCommentsAsNestedCommentaries(commentary, commentaryKind.className));
    } else {
      for (const comment of dedupeComments(commentary.comments)) {
        const nestedSegmentLabel = `${segmentLabel}.<nested>.${comment.ref}`;
        output.push(
          <IndividualComment key={comment.ref} comment={comment} commentaryKind={commentaryKind} />,
          <NestedCommentariesBlock
            commentaries={comment.commentary || {}}
            segmentLabel={nestedSegmentLabel}
            key={nestedSegmentLabel}
            depth={depth! + 1}
            />);
      }
    }
  }

  output.push(renderShowButtons());
  return <>{output}</>;
}
CommentariesBlock.propTypes = {
  commentaries: PropTypes.object,
  getOrdering: PropTypes.func,
  toggleShowing: PropTypes.func,
  segmentLabel: PropTypes.string,
  syntheticClassName: PropTypes.string,
  syntheticCommentaryKinds: PropTypes.object,
};
