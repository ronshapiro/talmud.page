import * as React from "react";
import {render} from "react-dom";
import {FontCache} from "./FontCache";
import {useIncrementer} from "./hooks";
import {LanguageChooser, Preferences} from "./Preferences";
import {isSiteLanguageHebrew} from "./settings";
import {
  MasechetProgress,
  PageProgress,
  TranslationProgressData,
  TranslationProgressSummary,
} from "../precomputed/translation_progress_data";

new FontCache().loadAll();

type SortOption =
  | "traditional"
  | "percent_descending"
  | "percent_ascending"
  | "complete_pages_descending"
  | "total_pages_descending"
  | "alphabetical";

function BackButton({onClick}: {onClick: () => void}): React.ReactElement {
  const useHebrew = isSiteLanguageHebrew();
  const positionStyle: React.CSSProperties = {
    position: "fixed",
    top: useHebrew ? "10px" : "50px",
    padding: "30px",
    zIndex: 10,
  };
  if (useHebrew) {
    positionStyle.right = "10px";
  } else {
    positionStyle.left = "10px";
  }

  return (
    <button
      style={positionStyle}
      className="mdl-button mdl-js-button mdl-button--icon mdl-js-ripple-effect"
      onClick={onClick}
      aria-label="Back">
      <i className="material-icons">{useHebrew ? "arrow_forward" : "arrow_back"}</i>
    </button>
  );
}

function SummaryCards({
  summary,
  isHebrew,
}: {
  summary: TranslationProgressSummary;
  isHebrew: boolean;
}): React.ReactElement {
  const completePercentage = (
    Math.round((summary.completePages / summary.totalPages) * 1000) / 10
  );
  const partialPercentage = (
    Math.round((summary.partialPages / summary.totalPages) * 1000) / 10
  );
  const notStartedPercentage = (
    Math.round((summary.notStartedPages / summary.totalPages) * 1000) / 10
  );

  return (
    <div className="metrics-grid">
      <div className="metric-card card-complete">
        <span className="metric-label">
          {isHebrew ? "דפים שהושלמו" : "Complete Pages"}
        </span>
        <span className="metric-value">
          {summary.completePages.toLocaleString()}
        </span>
        <span className="metric-subtext">
          {completePercentage}% {isHebrew ? "מכלל הדפים" : "of all pages"}
        </span>
      </div>

      <div className="metric-card card-partial">
        <span className="metric-label">
          {isHebrew ? "דפים בתהליך" : "Partially Complete"}
        </span>
        <span className="metric-value">
          {summary.partialPages.toLocaleString()}
        </span>
        <span className="metric-subtext">
          {partialPercentage}% {isHebrew ? "עם תרגום חלקי" : "with partial translation"}
        </span>
      </div>

      <div className="metric-card card-to-go">
        <span className="metric-label">
          {isHebrew ? "דפים שנותרו" : "Others To Go"}
        </span>
        <span className="metric-value">
          {summary.notStartedPages.toLocaleString()}
        </span>
        <span className="metric-subtext">
          {notStartedPercentage}% {isHebrew ? "טרם תורגמו" : "not yet started"}
        </span>
      </div>

      <div className="metric-card card-comments">
        <span className="metric-label">
          {isHebrew ? "פירושים שתורגמו" : "Translated Comments"}
        </span>
        <span className="metric-value">
          {summary.translatedComments.toLocaleString()}
        </span>
        <span className="metric-subtext">
          {isHebrew
            ? `מתוך ${summary.totalComments.toLocaleString()} (${summary.percentTranslatedComments}%)`
            : `out of ${summary.totalComments.toLocaleString()} (${summary.percentTranslatedComments}%)`}
        </span>
      </div>
    </div>
  );
}

function OverallProgressBar({
  summary,
  isHebrew,
}: {
  summary: TranslationProgressSummary;
  isHebrew: boolean;
}): React.ReactElement {
  const completeWidthPercentage = (summary.completePages / summary.totalPages) * 100;
  const partialWidthPercentage = (summary.partialPages / summary.totalPages) * 100;
  const toGoWidthPercentage = (summary.notStartedPages / summary.totalPages) * 100;

  return (
    <div className="overall-progress-section">
      <div className="overall-progress-title">
        <span>{isHebrew ? "התקדמות כוללת בש״ס" : "Overall Shas Progress"}</span>
        <span>
          {summary.completePages} / {summary.totalPages} {isHebrew ? "דפים" : "pages"} ({summary.percentCompletePages}%)
        </span>
      </div>

      <div className="stacked-progress-bar">
        <div
          className="progress-segment progress-segment-complete"
          style={{width: `${completeWidthPercentage}%`}}
          title={`${summary.completePages} complete pages (${Math.round(completeWidthPercentage * 10) / 10}%)`}
        />
        <div
          className="progress-segment progress-segment-partial"
          style={{width: `${partialWidthPercentage}%`}}
          title={`${summary.partialPages} partial pages (${Math.round(partialWidthPercentage * 10) / 10}%)`}
        />
        <div
          className="progress-segment progress-segment-to-go"
          style={{width: `${toGoWidthPercentage}%`}}
          title={`${summary.notStartedPages} pages to go (${Math.round(toGoWidthPercentage * 10) / 10}%)`}
        />
      </div>

      <div className="progress-legend">
        <div className="legend-item">
          <span className="legend-swatch progress-segment-complete" />
          <span>{isHebrew ? "הושלם (100%)" : "Complete (100%)"}</span>
        </div>
        <div className="legend-item">
          <span className="legend-swatch progress-segment-partial" />
          <span>{isHebrew ? "חלקי (1-99%)" : "Partially Complete (1-99%)"}</span>
        </div>
        <div className="legend-item">
          <span className="legend-swatch progress-segment-to-go" />
          <span>{isHebrew ? "טרם החל (0%)" : "Not Started (0%)"}</span>
        </div>
      </div>
    </div>
  );
}

function PageChip({
  canonicalName,
  page,
  isHebrew,
}: {
  canonicalName: string;
  page: PageProgress;
  isHebrew: boolean;
}): React.ReactElement {
  let chipClass = "page-chip page-chip-not-started";
  let statusText = isHebrew ? "טרם תורגם" : "Not started";

  if (page.status === "complete") {
    chipClass = "page-chip page-chip-complete";
    statusText = isHebrew ? "הושלם" : "Complete";
  } else if (page.status === "partial") {
    chipClass = "page-chip page-chip-partial";
    statusText = isHebrew ? "חלקי" : "Partial";
  } else if (page.status === "no_comments") {
    chipClass = "page-chip page-chip-no-comments";
    statusText = isHebrew ? "אין פירושי רש״י/תוספות" : "No Rashi/Tosafot comments";
  }

  const tooltip = (
    `${canonicalName} ${page.section}: ${page.translatedComments}/${page.totalComments} `
    + `${isHebrew ? "פירושים" : "comments"} (${statusText})`
  );

  return (
    <a
      href={`/${canonicalName}/${page.section}`}
      className={chipClass}
      title={tooltip}
      target="_blank"
      rel="noopener noreferrer">
      {page.section}
    </a>
  );
}

function MasechetRow({
  masechet,
  isHebrew,
  isExpanded,
  onToggleExpand,
}: {
  masechet: MasechetProgress;
  isHebrew: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
}): React.ReactElement {
  const completeWidth = (masechet.completePages / masechet.totalPages) * 100;
  const partialWidth = (masechet.partialPages / masechet.totalPages) * 100;
  const toGoWidth = (masechet.notStartedPages / masechet.totalPages) * 100;

  let badgeClass = "masechet-completion-badge badge-not-started";
  let badgeText = `${masechet.percentCompletePages}%`;

  if (masechet.completePages === masechet.totalPages && masechet.totalPages > 0) {
    badgeClass = "masechet-completion-badge badge-complete";
    badgeText = isHebrew ? "הושלם 100%" : "100% Complete";
  } else if (masechet.completePages > 0 || masechet.partialPages > 0) {
    badgeClass = "masechet-completion-badge badge-in-progress";
    badgeText = `${masechet.percentCompletePages}%`;
  }

  return (
    <div className="masechet-card">
      <div className="masechet-card-header">
        <div className="masechet-names">
          <span className="masechet-english-name">{masechet.canonicalName}</span>
          <span className="masechet-hebrew-name">{masechet.hebrewName}</span>
          <span className="masechet-seder-badge">
            {isHebrew ? masechet.sederHebrew : masechet.seder}
          </span>
        </div>

        <div className={badgeClass}>
          {badgeText}
        </div>
      </div>

      <div className="masechet-progress-bar-container">
        <div className="mini-stacked-progress-bar">
          <div
            className="progress-segment progress-segment-complete"
            style={{width: `${completeWidth}%`}}
          />
          <div
            className="progress-segment progress-segment-partial"
            style={{width: `${partialWidth}%`}}
          />
          <div
            className="progress-segment progress-segment-to-go"
            style={{width: `${toGoWidth}%`}}
          />
        </div>
      </div>

      <div className="masechet-stats-row">
        <div className="masechet-page-counts">
          <span className="page-count-complete">
            {masechet.completePages} {isHebrew ? "הושלמו" : "complete"}
          </span>
          <span>&bull;</span>
          <span className="page-count-partial">
            {masechet.partialPages} {isHebrew ? "חלקי" : "partial"}
          </span>
          <span>&bull;</span>
          <span className="page-count-to-go">
            {masechet.notStartedPages} {isHebrew ? "נותרו" : "to go"}
          </span>
          <span>&bull;</span>
          <span>
            {masechet.totalPages} {isHebrew ? "דפים סה״כ" : "total pages"}
          </span>
          <span>&bull;</span>
          <span>
            {masechet.translatedComments.toLocaleString()} / {masechet.totalComments.toLocaleString()} {isHebrew ? "פירושים" : "comments"} ({masechet.percentTranslatedComments}%)
          </span>
        </div>

        <button
          type="button"
          className="toggle-pages-button"
          onClick={onToggleExpand}>
          <i className="material-icons" style={{fontSize: "16px"}}>
            {isExpanded ? "expand_less" : "expand_more"}
          </i>
          <span>
            {isExpanded
              ? (isHebrew ? "הסתר דפים" : "Hide Pages")
              : (isHebrew ? `הצג ${masechet.totalPages} דפים` : `Show ${masechet.totalPages} Pages`)}
          </span>
        </button>
      </div>

      {isExpanded && (
        <div className="pages-grid">
          {masechet.pages.map(page => (
            <PageChip
              key={page.section}
              canonicalName={masechet.canonicalName}
              page={page}
              isHebrew={isHebrew}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const SEDARIM: {key: string; english: string; hebrew: string}[] = [
  {key: "All", english: "All Tractates", hebrew: "כל המסכתות"},
  {key: "Zeraim", english: "Zeraim", hebrew: "זרעים"},
  {key: "Moed", english: "Moed", hebrew: "מועד"},
  {key: "Nashim", english: "Nashim", hebrew: "נשים"},
  {key: "Nezikin", english: "Nezikin", hebrew: "נזיקין"},
  {key: "Kodashim", english: "Kodashim", hebrew: "קדשים"},
  {key: "Tahorot", english: "Tahorot", hebrew: "טהרות"},
];

function TranslationProgressDashboard({
  initialData,
}: {
  initialData?: TranslationProgressData;
}): React.ReactElement {
  const isHebrew = isSiteLanguageHebrew();
  const rerender = useIncrementer()[1];

  const [progressData, setProgressData] = React.useState<TranslationProgressData | undefined>(
    initialData,
  );
  const [selectedSeder, setSelectedSeder] = React.useState<string>("All");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [sortOption, setSortOption] = React.useState<SortOption>("traditional");
  const [expandedMasechtot, setExpandedMasechtot] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!progressData) {
      const embeddedScript = document.getElementById("translation-progress-data");
      if (embeddedScript && embeddedScript.textContent && embeddedScript.textContent.trim()) {
        try {
          const parsedData = JSON.parse(embeddedScript.textContent) as TranslationProgressData;
          setProgressData(parsedData);
          return;
        } catch {
          // Fall through to fetch
        }
      }

      fetch("/api/translation-progress")
        .then(response => response.json())
        .then((data: TranslationProgressData) => {
          setProgressData(data);
        })
        .catch(() => {
          // Error handling
        });
    }
  }, [progressData]);

  if (!progressData) {
    return (
      <div className="translation-dashboard-container" style={{textAlign: "center", paddingTop: "80px"}}>
        <h2>{isHebrew ? "טוען נתוני התקדמות..." : "Loading translation progress..."}</h2>
      </div>
    );
  }

  const toggleExpand = (canonicalName: string) => {
    setExpandedMasechtot(previousState => ({
      ...previousState,
      [canonicalName]: !previousState[canonicalName],
    }));
  };

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const filteredMasechtot = progressData.masechtot.filter(masechet => {
    const matchesSeder = selectedSeder === "All" || masechet.seder === selectedSeder;
    if (!matchesSeder) return false;

    if (!normalizedSearchQuery) return true;

    const matchesEnglish = masechet.canonicalName.toLowerCase().includes(normalizedSearchQuery);
    const matchesHebrew = masechet.hebrewName.includes(normalizedSearchQuery);
    return matchesEnglish || matchesHebrew;
  });

  const sortedMasechtot = [...filteredMasechtot].sort((firstMasechet, secondMasechet) => {
    switch (sortOption) {
      case "percent_descending":
        return secondMasechet.percentCompletePages - firstMasechet.percentCompletePages;
      case "percent_ascending":
        return firstMasechet.percentCompletePages - secondMasechet.percentCompletePages;
      case "complete_pages_descending":
        return secondMasechet.completePages - firstMasechet.completePages;
      case "total_pages_descending":
        return secondMasechet.totalPages - firstMasechet.totalPages;
      case "alphabetical":
        return firstMasechet.canonicalName.localeCompare(secondMasechet.canonicalName);
      case "traditional":
      default:
        return 0; // Preserves traditional order from array
    }
  });

  const handleBack = () => {
    window.location.assign("/");
  };

  return (
    <>
      <BackButton onClick={handleBack} />
      <LanguageChooser rerender={rerender} padding="32px"><></></LanguageChooser>
      <Preferences rerender={rerender} />

      <div className="translation-dashboard-container" dir={isHebrew ? "rtl" : "ltr"}>
        <div className="translation-dashboard-header">
          <h1 className="translation-dashboard-title">
            {isHebrew ? "התקדמות תרגום רש״י ותוספות" : "Rashi & Tosafot Translation Progress"}
          </h1>
          <p className="translation-dashboard-subtitle">
            {isHebrew
              ? "מעקב אחר התקדמות תרגום פירושי רש״י ותוספות לתלמוד בבלי לאנגלית"
              : "Tracking English translation completion across Talmud Bavli"}
          </p>
        </div>

        <SummaryCards summary={progressData.summary} isHebrew={isHebrew} />

        <OverallProgressBar summary={progressData.summary} isHebrew={isHebrew} />

        <div className="controls-bar">
          <div className="seder-filter-tabs">
            {SEDARIM.map(sederItem => (
              <button
                key={sederItem.key}
                type="button"
                className={`seder-tab-button ${selectedSeder === sederItem.key ? "selected" : ""}`}
                onClick={() => setSelectedSeder(sederItem.key)}>
                {isHebrew ? sederItem.hebrew : sederItem.english}
              </button>
            ))}
          </div>

          <div className="search-and-sort-row">
            <div className="search-input-wrapper">
              <input
                type="text"
                className="search-input"
                placeholder={isHebrew ? "חפש מסכת..." : "Search tractate..."}
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
              />
            </div>

            <div className="sort-select-wrapper">
              <span>{isHebrew ? "מיין לפי:" : "Sort by:"}</span>
              <select
                className="sort-select"
                value={sortOption}
                onChange={event => setSortOption(event.target.value as SortOption)}>
                <option value="traditional">
                  {isHebrew ? "סדר הש״ס המקורי" : "Traditional Order"}
                </option>
                <option value="percent_descending">
                  {isHebrew ? "% הושלם (מהגבוה לנמוך)" : "% Complete (Highest First)"}
                </option>
                <option value="percent_ascending">
                  {isHebrew ? "% הושלם (מהנמוך לגבוה)" : "% Complete (Lowest First)"}
                </option>
                <option value="complete_pages_descending">
                  {isHebrew ? "מספר דפים שהושלמו" : "Most Complete Pages"}
                </option>
                <option value="total_pages_descending">
                  {isHebrew ? "גודל המסכת (דפים)" : "Total Pages"}
                </option>
                <option value="alphabetical">
                  {isHebrew ? "סדר א״ב (אנגלית)" : "Alphabetical"}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div className="masechet-list">
          {sortedMasechtot.map(masechet => (
            <MasechetRow
              key={masechet.canonicalName}
              masechet={masechet}
              isHebrew={isHebrew}
              isExpanded={expandedMasechtot[masechet.canonicalName] ?? false}
              onToggleExpand={() => toggleExpand(masechet.canonicalName)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function initializeDashboard() {
  const rootElement = document.getElementById("main-contents");
  if (!rootElement) {
    setTimeout(initializeDashboard, 10);
    return;
  }

  let initialProgressData: TranslationProgressData | undefined;
  const embeddedScript = document.getElementById("translation-progress-data");
  if (embeddedScript && embeddedScript.textContent && embeddedScript.textContent.trim()) {
    try {
      initialProgressData = JSON.parse(embeddedScript.textContent) as TranslationProgressData;
    } catch {
      // Ignore parse error
    }
  }

  render(<TranslationProgressDashboard initialData={initialProgressData} />, rootElement);
}

initializeDashboard();
