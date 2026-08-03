import * as React from "react";
import * as PropTypes from "prop-types";
import {PageTitleMetadata} from "./PageTitleMetadata";
import {useConfiguration} from "./context";
import {Segment, UiSegment} from "./Segment";
import {useHtmlRef} from "./hooks";
import {LoadingSpinner} from "./LoadingSpinner";
import {$} from "./jquery";
import {ApiResponse} from "../apiTypes";
import {showPageMetadataPreference} from "./settings";

const {
  useEffect,
  useState,
} = React;

export interface UiPage extends ApiResponse {
  sections: UiSegment[];
  loading?: boolean;
  errorEnglish?: string;
}

interface Props {
  amudData: UiPage;
  // TODO: add typing here. But we do some ugly things in page_runner to get this to work.
  navigationExtension: any;
  firstRemovable: boolean;
  lastRemovable: boolean;
}

export function Page({
  amudData, navigationExtension, firstRemovable, lastRemovable,
}: Props): React.ReactElement {
  const context = useConfiguration();
  const headerRef = useHtmlRef<HTMLSpanElement>();
  const [showing, setShowing] = useState(true);
  const [expandMergedRef, setExpandMergedRef] = useState<Record<string, boolean | undefined>>({});
  const [lastUnexpandedUuid, setLastUnexpandedUuid] = useState<string | undefined>();

  useEffect(() => {
    $(headerRef.current).betterDoubleClick(() => setShowing(!showing));
  });

  const renderTitle = (): React.ReactElement => {
    const removableStyle = (firstRemovable || lastRemovable ? {} : {visibility: "hidden"}) as any;
    const onClick = () => {
      if (firstRemovable) navigationExtension.removeFirst();
      else if (lastRemovable) navigationExtension.removeLast();
    };
    // TODO: load buttons should also display hebrew text. This may be easier if the API returns
    // the texts instead of computing them on the client. This will also solve the problem of
    // missing Hebrew title text when loading the next page.
    const isEnglishTitle = context.translationOption() === "english-side-by-side";
    const title = isEnglishTitle ? amudData.title : amudData.titleHebrew;
    const className = isEnglishTitle ? "title" : "titleHebrew";
    const direction = isEnglishTitle ? "ltr" : "rtl";
    const removeSectionButton = navigationExtension.disableNavigation ? undefined : (
      <button
        className="mdl-button mdl-js-button mdl-button--icon mdl-button remove-section-button"
        style={removableStyle}
        onClick={() => onClick()}>
        <i className="material-icons">do_not_disturb_on</i>
      </button>
    );
    // eslint-disable-next-line react/no-danger
    const titleElement = <span dangerouslySetInnerHTML={{__html: title}} />;
    return (
      <div className="titleContainer" key="titleContainer">
        <span className={className} key="title" ref={headerRef} dir={direction}>
          {titleElement}
          {showPageMetadataPreference.get() === "true"
           && !amudData.loading
           && <> <PageTitleMetadata segments={amudData.sections} /></>}
        </span>
        {removeSectionButton}
      </div>);
  };

  const output = [];
  if (amudData.title) { // only in the case of the hidden host
    output.push(renderTitle());
  }
  if (amudData.loading) {
    output.push(<LoadingSpinner key="loading" />);
    if (amudData.errorEnglish) {
      output.push(
        <div key="error" style={{textAlign: "center", margin: "20px"}}>
          {amudData.errorEnglish}
        </div>,
      );
    }
  }

  // TODO: if not showing, update the UI so it's clear that it's collapsed
  if (showing) {
    const ignoredRefs = new Set(context.ignoredSectionRefs(amudData.id));
    const sections = amudData.sections.filter(x => !ignoredRefs.has(x.ref));
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];

      const makeSeparator = () => <br key={`separator-${i}`} className="section-separator" />;
      if (i !== 0 && (
        section.steinsaltz_start_of_sugya
          || section.hadran
          || section.ref === "Hadran 1")) {
        output.push(makeSeparator());
      }

      const sectionLabel = `${amudData.id}_section_${i + 1}`;
      const mergedSections = [section];
      while (i < sections.length) {
        const currentSection = sections[i];
        const nextSection = sections[i + 1];
        if (currentSection.lastSegmentOfSection) break;
        if (!currentSection.defaultMergeWithNext && !context.compactLayout()) break;
        if (expandMergedRef[currentSection.uuid]) break;
        if (nextSection && (
          expandMergedRef[nextSection.uuid]
            || nextSection.steinsaltz_start_of_sugya
            || nextSection.hadran
            || nextSection.ref.startsWith("Hadran "))) {
          break;
        }
        i++;
        if (i === sections.length) {
          break;
        }
        mergedSections.push(nextSection);
      }
      const toggleMerging = (uuid: string) => {
        const newExpandMergedRef = {...expandMergedRef};
        newExpandMergedRef[uuid] = !expandMergedRef[uuid];
        setExpandMergedRef(newExpandMergedRef);
        setLastUnexpandedUuid(newExpandMergedRef[uuid] ? undefined : uuid);
      };
      output.push(
        <Segment
          key={mergedSections[0].uuid + "+" + (mergedSections.length - 1)}
          segments={mergedSections}
          segmentLabel={sectionLabel}
          toggleMerging={toggleMerging}
          isExpanded={!!expandMergedRef[mergedSections[0].uuid]}
          lastUnexpandedUuid={lastUnexpandedUuid}
          />);
      if (i < sections.length - 1 && mergedSections.at(-1)!.lastSegmentOfSection) {
        output.push(makeSeparator());
      }
    }
  }
  return (
    <div id={`amud-${amudData.id}`} className="amudContainer" data-amud={amudData.id}>
      {output}
    </div>
  );
}
Page.propTypes = {
  amudData: PropTypes.object,
  navigationExtension: PropTypes.object,
  firstRemovable: PropTypes.bool,
  lastRemovable: PropTypes.bool,
};
