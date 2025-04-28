import * as React from "react";
import * as PropTypes from 'prop-types';
import {CommentariesBlock} from "./CommentariesBlock";
import TableRow, {CellText} from "./TableRow";
import {useConfiguration, useHiddenHost, HiddenHostContext} from "./context";
import {mergeCommentaries} from "./mergeCommentaries";
import {Section} from "../apiTypes";

const {useState} = React;

export interface UiSegment extends Section {
  uuid: string;
  steinsaltzRetained?: true;
  continuallyRewriteSteinsaltzEnglish?: boolean;
  sourceRef?: string;
  sourceHeRef?: string;
}

interface Props {
  segments: UiSegment[];
  segmentLabel: string;
  toggleMerging: (uuid: string) => void;
  isExpanded: boolean;
  lastUnexpandedUuid: string | undefined;
}

export function Segment({
  segments, segmentLabel, toggleMerging, isExpanded, lastUnexpandedUuid,
}: Props): React.ReactElement {
  const context = useConfiguration();
  const hiddenHost = useHiddenHost();
  // if this is the hidden host, populate the comments as open always
  const [showingState, setShowingState] = useState(() => {
    const state: Record<string, string[]> = {};
    if (isExpanded && context.expandTranslationOnMergedSegmentExpansion) {
      state[segmentLabel] = ["translation"];
    }
    if (!context.isFake) {
      return state;
    }
    state[segmentLabel] = ["rashi"];
    return state;
  });
  const [openedByDefault, setOpenedByDefault] = useState<Record<string, boolean>>({});

  const toggleShowing = (
    prependNew: boolean, toggledSegmentLabel: string, commentaryName: string,
    shouldOpenByDefault?: boolean) => {
    // TODO: reducer?
    let alreadyIncludes;
    setShowingState(previousState => {
      const newState = {...previousState};

      if (!(toggledSegmentLabel in newState)) {
        newState[toggledSegmentLabel] = [];
      }
      const commentOrderingForSegment = newState[toggledSegmentLabel];
      alreadyIncludes = commentOrderingForSegment.includes(commentaryName);

      if (shouldOpenByDefault) {
        const indexKey = toggledSegmentLabel + commentaryName;
        if (openedByDefault[indexKey]) {
          return previousState;
        } else {
          setOpenedByDefault(previousOpenByDefault => Object.assign(
            previousOpenByDefault, Object.fromEntries([[indexKey, true]])));
        }
      }

      if (alreadyIncludes) {
        newState[toggledSegmentLabel] = commentOrderingForSegment.filter(x => x !== commentaryName);
      } else if (prependNew) {
        commentOrderingForSegment.unshift(commentaryName);
      } else {
        commentOrderingForSegment.push(commentaryName);
      }
      return newState;
    });

    return !alreadyIncludes;
  };

  const segmentContents = [];
  const hebrewDoubleClickListener = () => {
    for (const segment of segments) {
      if (segment?.commentary?.Translation || segment?.commentary?.Steinsaltz) {
        toggleShowing(true, segmentLabel, "translation");
        break;
      }
    }
  };

  const gemaraContainerClasses = ["gemara-container"];
  for (const segment of segments) {
    if (segment.hadran) {
      gemaraContainerClasses.push("hadran");
      break;
    }
  }

  const hebrews: string[] = [];
  const englishes: string[] = [];
  for (const segment of segments) {
    hebrews.push(segment.he as string);
    if (context.translationOption() === "english-side-by-side") {
      englishes.push(segment.en as string);
    }
  }

  const isStandaloneSegment = segments.length === 1;
  const createText = (texts: string[], languageClass: string) => {
    if (texts.length === 0) {
      return "";
    }
    const elements = [];
    for (let i = 0; i < texts.length; i++) {
      const {ref, uuid} = segments[i];
      const onDoubleClick = texts.length !== 1 ? () => toggleMerging(uuid) : undefined;
      const classes = lastUnexpandedUuid === uuid ? ["fadeInBackground"] : [];
      elements.push(
        // TODO: consider another gesture so that the double clicking is not overloaded.
        <CellText
          text={texts[i]}
          languageClass={languageClass}
          key={`segment-part-${i}`}
          onDoubleClick={onDoubleClick}
          classes={classes}
          sefariaRef={ref}
          segmentIdForHighlighting={isStandaloneSegment ? undefined : ref} />);
      if (i + 1 < texts.length) {
        elements.push(<span key={`segment-part-${i}-space`}> </span>);
      }
    }
    return <span>{elements}</span>;
  };

  segmentContents.push(
    <TableRow
      key="gemara"
      id={`${segmentLabel}-gemara`}
      hebrew={createText(hebrews, "hebrew-ref-text")}
      hebrewDoubleClickListener={hebrews.length === 1 ? hebrewDoubleClickListener : undefined}
      english={createText(englishes, "english-ref-text")}
      expandEnglishByDefault={context.expandEnglishByDefault()}
      classes={gemaraContainerClasses}
      onUnexpand={isExpanded ? () => toggleMerging(segments[0].uuid) : undefined}
      segmentIdForHighlighting={isStandaloneSegment ? segments[0].ref : undefined}
    />,
  );

  const commentary = mergeCommentaries(segments);
  if (commentary) {
    const commentaryBlock = (
      <CommentariesBlock
        key="CommentariesBlock"
        commentaries={commentary}
        getOrdering={commentSegmentLabel => showingState[commentSegmentLabel] || []}
        toggleShowing={(...args) => toggleShowing(false, ...args)}
        segmentLabel={segmentLabel} />
    );

    if (!context.isFake) {
      // hiddenHost will be undefined for the segment inside the actual hidden host
      segmentContents.push(
        <HiddenHostContext.Provider value={hiddenHost.forComments} key="commentaryBlock">
          {commentaryBlock}
        </HiddenHostContext.Provider>);
    } else {
      segmentContents.push(commentaryBlock);
    }
  }

  return (
    // The sefaria-ref here is used for determining what the "parent" of the selected ref is, so for
    // the case of a commentary, the comment can be placed accordingly in the Google doc. If
    // `segments` has more than 1 element, the ref that is used could be the first ref or the last
    // ref. The last seems more logical, since the ordering of comments from merged segments should
    // be placed after every containing ref. But this isn't absolute and could result in some
    // weirdness.
    <div id={segmentLabel} className="segment-container" sefaria-ref={segments.at(-1)!.ref}>
      {segmentContents}
    </div>
  );
}

Segment.propTypes = {
  segments: PropTypes.arrayOf(PropTypes.object),
  segmentLabel: PropTypes.string,
  toggleMerging: PropTypes.func,
  isExpanded: PropTypes.bool,
  lastUnexpandedUuid: PropTypes.string,
};
