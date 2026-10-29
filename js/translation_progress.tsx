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
  TranslationTimelinePoint,
} from "../precomputed/translation_progress_data";

new FontCache().loadAll();

type SortOption =
  | "traditional"
  | "percent_descending"
  | "percent_ascending"
  | "complete_pages_descending"
  | "total_pages_descending"
  | "alphabetical";

type TimelineDisplayMode = "cumulative" | "daily";

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
          {completePercentage}% {isHebrew ? "מכלל הדפים בש״ס" : "of all Talmud pages"}
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
          {summary.completePages.toLocaleString()} / {summary.totalPages.toLocaleString()} {isHebrew ? "דפים" : "pages"} ({summary.percentCompletePages}%)
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

function formatDateLabel(dateString: string, isHebrew: boolean): string {
  const [year, month, day] = dateString.split("-");
  const monthNamesEnglish = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthNamesHebrew = [
    "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
    "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
  ];
  const monthIndex = parseInt(month, 10) - 1;
  const monthName = isHebrew ? monthNamesHebrew[monthIndex] : monthNamesEnglish[monthIndex];
  if (day) {
    return `${monthName} ${parseInt(day, 10)}, ${year}`;
  }
  return `${monthName} ${year}`;
}

function TranslationTimelineChart({
  timeline,
  isHebrew,
}: {
  timeline: TranslationTimelinePoint[];
  isHebrew: boolean;
}): React.ReactElement {
  const [displayMode, setDisplayMode] = React.useState<TimelineDisplayMode>("cumulative");
  const [hoveredIndex, setHoveredIndex] = React.useState<number | undefined>(undefined);

  if (!timeline || timeline.length === 0) {
    return <></>;
  }

  const chartViewBoxWidth = 840;
  const chartViewBoxHeight = 280;
  const paddingLeft = 65;
  const paddingRight = 35;
  const paddingTop = 25;
  const paddingBottom = 45;

  const plotWidth = chartViewBoxWidth - paddingLeft - paddingRight;
  const plotHeight = chartViewBoxHeight - paddingTop - paddingBottom;

  const values = timeline.map(point => (
    displayMode === "cumulative" ? point.cumulativeCount : point.dailyCount
  ));

  const maxDataValue = Math.max(...values, 100);
  // Round up to nice number for Y axis
  const niceMultiplier = 10 ** Math.floor(Math.log10(maxDataValue));
  const yAxisMaximum = Math.ceil(maxDataValue / niceMultiplier) * niceMultiplier;

  const pointsCount = timeline.length;
  const coordinates = timeline.map((point, index) => {
    const value = displayMode === "cumulative" ? point.cumulativeCount : point.dailyCount;
    const x = paddingLeft + (index / Math.max(pointsCount - 1, 1)) * plotWidth;
    const y = paddingTop + plotHeight - (value / yAxisMaximum) * plotHeight;
    return {x, y, value, point};
  });

  const pathCommands = coordinates.map((coord, index) => (
    `${index === 0 ? "M" : "L"} ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`
  )).join(" ");

  const areaCommands = (
    `${pathCommands} `
    + `L ${coordinates[coordinates.length - 1].x.toFixed(1)} ${(paddingTop + plotHeight).toFixed(1)} `
    + `L ${coordinates[0].x.toFixed(1)} ${(paddingTop + plotHeight).toFixed(1)} Z`
  );

  const yGridSteps = 4;
  const yGridLines = [];
  for (let step = 0; step <= yGridSteps; step++) {
    const valueAtStep = Math.round((yAxisMaximum / yGridSteps) * step);
    const yPosition = paddingTop + plotHeight - (step / yGridSteps) * plotHeight;
    yGridLines.push({
      value: valueAtStep,
      y: yPosition,
    });
  }

  // Pick up to 5 evenly spaced dates for X axis
  const xGridLines = [];
  const xLabelSteps = Math.min(5, pointsCount);
  for (let step = 0; step < xLabelSteps; step++) {
    const targetIndex = Math.min(
      Math.round((step / (xLabelSteps - 1)) * (pointsCount - 1)),
      pointsCount - 1,
    );
    const point = timeline[targetIndex];
    const xPosition = paddingLeft + (targetIndex / Math.max(pointsCount - 1, 1)) * plotWidth;
    xGridLines.push({
      date: point.date,
      x: xPosition,
    });
  }

  const handleMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const svgRect = event.currentTarget.getBoundingClientRect();
    const mouseXRelative = (event.clientX - svgRect.left) / svgRect.width;
    const mouseXInViewBox = mouseXRelative * chartViewBoxWidth;

    if (mouseXInViewBox >= paddingLeft && mouseXInViewBox <= paddingLeft + plotWidth) {
      const normalizedRatio = (mouseXInViewBox - paddingLeft) / plotWidth;
      const closestIndex = Math.round(normalizedRatio * (pointsCount - 1));
      setHoveredIndex(Math.max(0, Math.min(closestIndex, pointsCount - 1)));
    }
  };

  const activeCoordinate = (
    hoveredIndex !== undefined && hoveredIndex < coordinates.length
      ? coordinates[hoveredIndex]
      : coordinates[coordinates.length - 1]
  );

  return (
    <div className="timeline-card">
      <div className="timeline-header-row">
        <div className="timeline-title-group">
          <h2>
            {isHebrew ? "התקדמות התרגום לאורך זמן" : "Translation Progress Over Time"}
          </h2>
          <p className="timeline-subtitle">
            {isHebrew
              ? "מעקב אחר קצב התרגום המצטבר והיומי מאז תחילת הפרויקט"
              : "Tracking cumulative and daily translation velocity across Talmud Bavli"}
          </p>
        </div>

        <div className="timeline-toggle-group">
          <button
            type="button"
            className={`timeline-toggle-button ${displayMode === "cumulative" ? "active" : ""}`}
            onClick={() => setDisplayMode("cumulative")}>
            {isHebrew ? "סך הכל מצטבר" : "Cumulative Total"}
          </button>
          <button
            type="button"
            className={`timeline-toggle-button ${displayMode === "daily" ? "active" : ""}`}
            onClick={() => setDisplayMode("daily")}>
            {isHebrew ? "תוספת יומית" : "Daily Volume"}
          </button>
        </div>
      </div>

      <div className="timeline-svg-container">
        {activeCoordinate && (
          <div className="chart-tooltip-panel">
            <div className="chart-tooltip-date">
              {formatDateLabel(activeCoordinate.point.date, isHebrew)}
            </div>
            <div className="chart-tooltip-metric">
              {displayMode === "cumulative"
                ? `${activeCoordinate.point.cumulativeCount.toLocaleString()} ${isHebrew ? "פירושים סה״כ" : "comments translated"}`
                : `+${activeCoordinate.point.dailyCount.toLocaleString()} ${isHebrew ? "פירושים באותו יום" : "comments translated"}`}
            </div>
          </div>
        )}

        <svg
          viewBox={`0 0 ${chartViewBoxWidth} ${chartViewBoxHeight}`}
          className="timeline-svg"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIndex(undefined)}>
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--dashboard-chart-line)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--dashboard-chart-line)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines and Y labels */}
          {yGridLines.map(gridLine => (
            <g key={gridLine.value}>
              <line
                x1={paddingLeft}
                y1={gridLine.y}
                x2={paddingLeft + plotWidth}
                y2={gridLine.y}
                className="chart-grid-line"
              />
              <text
                x={paddingLeft - 10}
                y={gridLine.y + 4}
                textAnchor="end"
                className="chart-axis-text">
                {gridLine.value >= 1000
                  ? `${Math.round(gridLine.value / 1000)}k`
                  : gridLine.value.toLocaleString()}
              </text>
            </g>
          ))}

          {/* Area under curve */}
          {displayMode === "cumulative" && (
            <path d={areaCommands} fill="url(#chartGradient)" />
          )}

          {/* Main trend line */}
          <path
            d={pathCommands}
            className={
              displayMode === "cumulative" ? "chart-line-path" : "chart-line-path-daily"
            }
          />

          {/* Vertical Crosshair and Active Point on hover */}
          {activeCoordinate && (
            <g>
              <line
                x1={activeCoordinate.x}
                y1={paddingTop}
                x2={activeCoordinate.x}
                y2={paddingTop + plotHeight}
                className="chart-crosshair-line"
              />
              <circle
                cx={activeCoordinate.x}
                cy={activeCoordinate.y}
                r="6"
                fill="var(--dashboard-chart-line)"
                stroke="var(--dashboard-card-background)"
                strokeWidth="2.5"
              />
            </g>
          )}

          {/* X axis baseline and date labels */}
          <line
            x1={paddingLeft}
            y1={paddingTop + plotHeight}
            x2={paddingLeft + plotWidth}
            y2={paddingTop + plotHeight}
            stroke="var(--dashboard-chart-axis)"
            strokeWidth="1.5"
          />

          {xGridLines.map(gridLine => (
            <text
              key={gridLine.date}
              x={gridLine.x}
              y={paddingTop + plotHeight + 24}
              textAnchor="middle"
              className="chart-axis-text">
              {formatDateLabel(gridLine.date, isHebrew)}
            </text>
          ))}
        </svg>
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

  const isDarkMode = localStorage.darkMode === "true";

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

  const containerThemeClass = isDarkMode ? "theme-dark" : "theme-light";

  return (
    <>
      <BackButton onClick={handleBack} />
      <LanguageChooser rerender={rerender} padding="32px"><></></LanguageChooser>
      <Preferences rerender={rerender} />

      <div className={`translation-dashboard-container ${containerThemeClass}`} dir={isHebrew ? "rtl" : "ltr"}>
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

        {progressData.timeline && progressData.timeline.length > 0 && (
          <TranslationTimelineChart timeline={progressData.timeline} isHebrew={isHebrew} />
        )}

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
