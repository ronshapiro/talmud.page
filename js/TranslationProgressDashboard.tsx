import * as React from "react";
import {useIncrementer} from "./hooks";
import {LanguageChooser, Preferences} from "./Preferences";
import {
  isSiteLanguageHebrew,
  TRANSLATION_PROGRESS_SORT_OPTIONS,
  TranslationProgressSortOption,
  translationProgressSortOrder,
  translationProgressSortOrderPreference,
} from "./settings";
import {
  computeProgressSummary,
  computeSevenDayRollingPace,
  hasTranslatableComments,
  MasechetProgress,
  PageProgress,
  roundPercentage,
  TranslationProgressData,
  TranslationProgressSummary,
  TranslationTimelinePoint,
} from "../precomputed/translation_progress_summary";

export type TimelineDisplayMode = "seven_day" | "daily" | "cumulative";

function BackButton({onClick}: {onClick: () => void}): React.ReactElement {
  const useHebrew = isSiteLanguageHebrew();
  const positionStyle: React.CSSProperties = {
    position: "fixed",
    top: useHebrew ? "12px" : "50px",
    padding: "30px",
    zIndex: 10,
  };
  if (useHebrew) {
    positionStyle.right = "12px";
  } else {
    positionStyle.left = "12px";
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
  const completePercentage = roundPercentage(summary.completePages, summary.totalPages);

  return (
    <div className="metrics-grid">
      <div className="metric-card card-complete">
        <div className="metric-card-top-bar" />
        <div className="metric-header">
          <span className="metric-label">
            {isHebrew ? "דפים שהושלמו" : "Complete Pages"}
          </span>
          <span className="metric-pill" />
        </div>
        <span className="metric-value">
          {summary.completePages.toLocaleString()}
        </span>
        <span className="metric-subtext">
          <span className="metric-subtext-highlight">{completePercentage}%</span>{" "}
          {isHebrew ? "מכלל הדפים בש״ס" : "of all Talmud pages"}
        </span>
      </div>

      <div className="metric-card card-comments">
        <div className="metric-card-top-bar" />
        <div className="metric-header">
          <span className="metric-label">
            {isHebrew ? "פירושים שתורגמו" : "Translated Comments"}
          </span>
          <span className="metric-pill" />
        </div>
        <span className="metric-value">
          {summary.translatedComments.toLocaleString()}
        </span>
        <span className="metric-subtext">
          {isHebrew ? "מתוך " : "out of "}
          {summary.totalComments.toLocaleString()} (
          <span className="metric-subtext-highlight">{summary.percentTranslatedComments}%</span>)
        </span>
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

interface ChartCoordinate {
  x: number;
  y: number;
  value: number;
  point: TranslationTimelinePoint;
}

const Y_GRID_STEPS = 4;
const NICE_AXIS_STEP_FACTORS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

function computeNiceYAxisMaximum(maxDataValue: number): number {
  const effectiveMax = Math.max(maxDataValue, 100);
  const rawStep = effectiveMax / Y_GRID_STEPS;
  const stepMagnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / stepMagnitude;
  const matchingFactor = (
    NICE_AXIS_STEP_FACTORS.find(factor => factor >= normalizedStep) ?? 10
  );
  return matchingFactor * stepMagnitude * Y_GRID_STEPS;
}

function formatYAxisLabel(value: number): string {
  if (value >= 1000) {
    return `${Number((value / 1000).toFixed(2))}k`;
  }
  return value.toLocaleString();
}

function formatSevenDayPaceValue(value: number): string {
  if (value > 0 && value < 1) {
    return (Math.round(value * 10) / 10).toLocaleString();
  }
  return Math.round(value).toLocaleString();
}

function buildLinearSvgPath(coordinates: Pick<ChartCoordinate, "x" | "y">[]): string {
  return coordinates.map((coordinate, index) => (
    `${index === 0 ? "M" : "L"} ${coordinate.x.toFixed(1)} ${coordinate.y.toFixed(1)}`
  )).join(" ");
}

/**
 * Generates an SVG path using Fritsch-Carlson monotone cubic Hermite interpolation so the
 * smoothed curve passes through every data point without overshooting extrema or dipping below 0.
 */
export function buildSmoothSvgPath(coordinates: Pick<ChartCoordinate, "x" | "y">[]): string {
  const pointCount = coordinates.length;
  if (pointCount <= 2) {
    return buildLinearSvgPath(coordinates);
  }

  const segmentWidths: number[] = [];
  const segmentSlopes: number[] = [];
  for (let i = 0; i < pointCount - 1; i++) {
    const segmentWidth = coordinates[i + 1].x - coordinates[i].x;
    const heightDelta = coordinates[i + 1].y - coordinates[i].y;
    segmentWidths.push(segmentWidth);
    segmentSlopes.push(segmentWidth === 0 ? 0 : heightDelta / segmentWidth);
  }

  const tangents = new Array<number>(pointCount).fill(0);
  const [firstSlope] = segmentSlopes;
  tangents[0] = firstSlope;
  tangents[pointCount - 1] = segmentSlopes[pointCount - 2];

  for (let i = 1; i < pointCount - 1; i++) {
    const previousSlope = segmentSlopes[i - 1];
    const nextSlope = segmentSlopes[i];
    if (previousSlope * nextSlope <= 0) {
      tangents[i] = 0;
    } else {
      const previousWidth = segmentWidths[i - 1];
      const nextWidth = segmentWidths[i];
      const previousWeight = 2 * nextWidth + previousWidth;
      const nextWeight = nextWidth + 2 * previousWidth;
      tangents[i] = (
        (previousWeight + nextWeight)
        / (previousWeight / previousSlope + nextWeight / nextSlope)
      );
    }
  }

  // Clamp adjacent tangent ratios to the Fritsch-Carlson circle (radius 3) for monotonicity.
  for (let i = 0; i < pointCount - 1; i++) {
    const slope = segmentSlopes[i];
    if (slope === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
    } else {
      const previousRatio = tangents[i] / slope;
      const nextRatio = tangents[i + 1] / slope;
      const squaredMagnitude = previousRatio * previousRatio + nextRatio * nextRatio;
      if (squaredMagnitude > 9) {
        const scaleFactor = 3 / Math.sqrt(squaredMagnitude);
        tangents[i] = scaleFactor * previousRatio * slope;
        tangents[i + 1] = scaleFactor * nextRatio * slope;
      }
    }
  }

  const commands = [`M ${coordinates[0].x.toFixed(1)} ${coordinates[0].y.toFixed(1)}`];
  for (let i = 0; i < pointCount - 1; i++) {
    const thirdSegmentWidth = segmentWidths[i] / 3;
    const firstControlX = coordinates[i].x + thirdSegmentWidth;
    const firstControlY = coordinates[i].y + thirdSegmentWidth * tangents[i];
    const secondControlX = coordinates[i + 1].x - thirdSegmentWidth;
    const secondControlY = coordinates[i + 1].y - thirdSegmentWidth * tangents[i + 1];
    commands.push(
      `C ${firstControlX.toFixed(1)} ${firstControlY.toFixed(1)}, `
      + `${secondControlX.toFixed(1)} ${secondControlY.toFixed(1)}, `
      + `${coordinates[i + 1].x.toFixed(1)} ${coordinates[i + 1].y.toFixed(1)}`,
    );
  }
  return commands.join(" ");
}

interface TimelineModeConfig {
  labelEnglish: string;
  labelHebrew: string;
  lineClassName: string;
  pointColor: string;
  gradientId?: string;
  liveStatClassName: string;
  smooth: boolean;
  ariaDescriptionEnglish: string;
  ariaDescriptionHebrew: string;
  formatHoveredStat: (coordinate: ChartCoordinate, isHebrew: boolean) => string;
  formatLatestDateLabel: (isHebrew: boolean) => string;
  formatLatestValueLabel: (coordinate: ChartCoordinate, isHebrew: boolean) => string;
}

const TIMELINE_MODE_ORDER: TimelineDisplayMode[] = ["seven_day", "daily", "cumulative"];

const TIMELINE_MODE_CONFIG: Record<TimelineDisplayMode, TimelineModeConfig> = {
  seven_day: {
    labelEnglish: "7-Day Pace",
    labelHebrew: "ממוצע 7 ימים",
    lineClassName: "chart-line-path-seven-day",
    pointColor: "var(--chart-line-seven-day)",
    gradientId: "chartGradientSevenDay",
    liveStatClassName: "live-stat-value live-stat-value-seven-day",
    smooth: true,
    ariaDescriptionEnglish: "7-day rolling average daily translation pace over time",
    ariaDescriptionHebrew: "קצב התרגום היומי הממוצע בחלונות של 7 ימים לאורך זמן",
    formatHoveredStat: (coordinate, isHebrew) => (
      `${formatSevenDayPaceValue(coordinate.value)} `
      + `${isHebrew ? "פירושים ליום (ממוצע 7 ימים)" : "comments/day (7-day avg)"}`
    ),
    formatLatestDateLabel: isHebrew => (isHebrew ? "קצב 7 ימים אחרון" : "Latest 7-day pace"),
    formatLatestValueLabel: (coordinate, isHebrew) => (
      `${formatSevenDayPaceValue(coordinate.value)} `
      + `${isHebrew ? "פירושים ליום" : "comments/day"}`
    ),
  },
  daily: {
    labelEnglish: "Daily Pace",
    labelHebrew: "יומי",
    lineClassName: "chart-line-path-daily",
    pointColor: "var(--chart-line-daily)",
    gradientId: undefined,
    liveStatClassName: "live-stat-value live-stat-value-daily",
    smooth: false,
    ariaDescriptionEnglish: "Daily translation count over time",
    ariaDescriptionHebrew: "כמות התרגומים היומית לאורך זמן",
    formatHoveredStat: (coordinate, isHebrew) => (
      `+${coordinate.point.dailyCount.toLocaleString()} ${isHebrew ? "ביום זה" : "on this day"}`
    ),
    formatLatestDateLabel: isHebrew => (isHebrew ? "יום אחרון" : "Latest day"),
    formatLatestValueLabel: (coordinate, isHebrew) => (
      `+${coordinate.point.dailyCount.toLocaleString()} ${isHebrew ? "פירושים" : "comments"}`
    ),
  },
  cumulative: {
    labelEnglish: "Cumulative",
    labelHebrew: "מצטבר",
    lineClassName: "chart-line-path",
    pointColor: "var(--chart-line)",
    gradientId: "chartGradientCumulative",
    liveStatClassName: "live-stat-value",
    smooth: false,
    ariaDescriptionEnglish: "Cumulative translated comments over time",
    ariaDescriptionHebrew: "סך הפירושים המתורגמים המצטבר לאורך זמן",
    formatHoveredStat: (coordinate, isHebrew) => (
      `${coordinate.point.cumulativeCount.toLocaleString()} ${isHebrew ? "פירושים" : "comments"}`
    ),
    formatLatestDateLabel: isHebrew => (isHebrew ? "סך הכל עד כה" : "Current total"),
    formatLatestValueLabel: (coordinate, isHebrew) => (
      `${coordinate.point.cumulativeCount.toLocaleString()} ${isHebrew ? "פירושים" : "comments"}`
    ),
  },
};

function TranslationTimelineChart({
  timeline,
  isHebrew,
}: {
  timeline: TranslationTimelinePoint[];
  isHebrew: boolean;
}): React.ReactElement {
  const [displayMode, setDisplayMode] = React.useState<TimelineDisplayMode>("seven_day");
  const [hoveredIndex, setHoveredIndex] = React.useState<number | undefined>(undefined);

  const sevenDayPaceValues = React.useMemo(
    () => (timeline ? computeSevenDayRollingPace(timeline) : []),
    [timeline],
  );

  if (!timeline || timeline.length === 0) {
    return <></>;
  }

  const chartViewBoxWidth = 840;
  const chartViewBoxHeight = 260;
  const paddingLeft = 55;
  const paddingRight = 25;
  const paddingTop = 20;
  const paddingBottom = 40;

  const plotWidth = chartViewBoxWidth - paddingLeft - paddingRight;
  const plotHeight = chartViewBoxHeight - paddingTop - paddingBottom;

  const values = timeline.map((point, index) => {
    if (displayMode === "seven_day") {
      return sevenDayPaceValues[index];
    }
    if (displayMode === "cumulative") {
      return point.cumulativeCount;
    }
    return point.dailyCount;
  });

  const yAxisMaximum = computeNiceYAxisMaximum(Math.max(...values, 100));

  const pointsCount = timeline.length;
  const coordinates: ChartCoordinate[] = timeline.map((point, index) => {
    const value = values[index];
    const x = paddingLeft + (index / Math.max(pointsCount - 1, 1)) * plotWidth;
    const y = paddingTop + plotHeight - (value / yAxisMaximum) * plotHeight;
    return {x, y, value, point};
  });

  const modeConfig = TIMELINE_MODE_CONFIG[displayMode];
  const pathCommands = modeConfig.smooth
    ? buildSmoothSvgPath(coordinates)
    : buildLinearSvgPath(coordinates);

  const areaCommands = (
    `${pathCommands} `
    + `L ${coordinates[coordinates.length - 1].x.toFixed(1)} ${(paddingTop + plotHeight).toFixed(1)} `
    + `L ${coordinates[0].x.toFixed(1)} ${(paddingTop + plotHeight).toFixed(1)} Z`
  );

  const yGridLines = [];
  for (let step = 0; step <= Y_GRID_STEPS; step++) {
    const valueAtStep = Math.round((yAxisMaximum / Y_GRID_STEPS) * step);
    const yPosition = paddingTop + plotHeight - (step / Y_GRID_STEPS) * plotHeight;
    yGridLines.push({
      value: valueAtStep,
      y: yPosition,
    });
  }

  const xGridLines = [];
  const xLabelSteps = Math.min(5, pointsCount);
  for (let step = 0; step < xLabelSteps; step++) {
    const targetIndex = xLabelSteps <= 1
      ? 0
      : Math.min(
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

  const latestCoordinate = coordinates[coordinates.length - 1];
  const activeCoordinate = (
    hoveredIndex !== undefined && hoveredIndex < coordinates.length
      ? coordinates[hoveredIndex]
      : undefined
  );

  return (
    <div className="timeline-card">
      <div className="timeline-header-row">
        <div className="timeline-title-group">
          <h2>
            {isHebrew ? "קצב התרגום לאורך זמן" : "Translation Velocity Over Time"}
          </h2>
          <p className="timeline-subtitle">
            {isHebrew
              ? "מעקב אחר ממוצע 7 ימים, הספק יומי והתקדמות מצטברת"
              : "Tracking 7-day rolling pace, daily output, and cumulative progress"}
          </p>
        </div>

        <div
          className="timeline-toggle-group"
          role="group"
          aria-label={isHebrew ? "סוג תצוגת ציר הזמן" : "Timeline display mode"}>
          {TIMELINE_MODE_ORDER.map(mode => {
            const buttonConfig = TIMELINE_MODE_CONFIG[mode];
            const isActive = displayMode === mode;
            return (
              <button
                key={mode}
                type="button"
                className={`timeline-toggle-button ${isActive ? "active" : ""}`}
                aria-pressed={isActive}
                onClick={() => setDisplayMode(mode)}>
                {isHebrew ? buttonConfig.labelHebrew : buttonConfig.labelEnglish}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dedicated readout row so variable-width stats never reflow header controls or overflow */}
      <div className="timeline-stat-row">
        <div className="timeline-live-stat">
          {activeCoordinate ? (
            <>
              <span className="live-stat-date">
                {formatDateLabel(activeCoordinate.point.date, isHebrew)}
              </span>
              <span className="live-stat-divider" />
              <span className={modeConfig.liveStatClassName}>
                {modeConfig.formatHoveredStat(activeCoordinate, isHebrew)}
              </span>
            </>
          ) : (
            <>
              <span className="live-stat-date">
                {modeConfig.formatLatestDateLabel(isHebrew)}
              </span>
              <span className="live-stat-divider" />
              <span className={modeConfig.liveStatClassName}>
                {modeConfig.formatLatestValueLabel(latestCoordinate, isHebrew)}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="timeline-svg-container">
        <svg
          role="img"
          aria-label={isHebrew
            ? modeConfig.ariaDescriptionHebrew
            : modeConfig.ariaDescriptionEnglish}
          viewBox={`0 0 ${chartViewBoxWidth} ${chartViewBoxHeight}`}
          className="timeline-svg"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredIndex(undefined)}>
          <defs>
            <linearGradient id="chartGradientCumulative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-line)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--chart-line)" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="chartGradientSevenDay" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-line-seven-day)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--chart-line-seven-day)" stopOpacity="0.0" />
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
                {formatYAxisLabel(gridLine.value)}
              </text>
            </g>
          ))}

          {/* Area under curve */}
          {modeConfig.gradientId && coordinates.length > 1 && (
            <path d={areaCommands} fill={`url(#${modeConfig.gradientId})`} />
          )}

          {/* Main trend line */}
          <path
            d={pathCommands}
            className={modeConfig.lineClassName}
          />

          {coordinates.length === 1 && (
            <circle
              cx={coordinates[0].x}
              cy={coordinates[0].y}
              r="4"
              fill={modeConfig.pointColor}
            />
          )}

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
                r="5"
                fill={modeConfig.pointColor}
                stroke="var(--surface-background)"
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
            stroke="var(--surface-border)"
            strokeWidth="1"
          />

          {xGridLines.map(gridLine => (
            <text
              key={gridLine.date}
              x={gridLine.x}
              y={paddingTop + plotHeight + 22}
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
  const hasComments = hasTranslatableComments(masechet);
  const completeWidth = hasComments ? (masechet.completePages / masechet.totalPages) * 100 : 0;
  const partialWidth = hasComments ? (masechet.partialPages / masechet.totalPages) * 100 : 0;
  const toGoWidth = hasComments ? (masechet.notStartedPages / masechet.totalPages) * 100 : 0;

  let badgeClass = "masechet-completion-badge badge-not-started";
  let badgeText = `${masechet.percentCompletePages}%`;

  if (!hasComments) {
    badgeClass = "masechet-completion-badge badge-no-comments";
    badgeText = isHebrew ? "אין רש״י/תוספות" : "No Rashi/Tosafot";
  } else if (masechet.completePages === masechet.totalPages && masechet.totalPages > 0) {
    badgeClass = "masechet-completion-badge badge-complete";
    badgeText = isHebrew ? "100% הושלם" : "100% Complete";
  } else if (masechet.completePages > 0 || masechet.partialPages > 0) {
    badgeClass = "masechet-completion-badge badge-in-progress";
    badgeText = `${masechet.percentCompletePages}%`;
  }

  return (
    <div className={`masechet-card${hasComments ? "" : " masechet-card-no-comments"}`}>
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

      {hasComments && (
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
      )}

      <div className="masechet-stats-row">
        {hasComments ? (
          <div className="masechet-page-counts">
            <span className="page-count-complete">
              {masechet.completePages} {isHebrew ? "הושלמו" : "complete"}
            </span>
            <span className="page-count-divider">&bull;</span>
            <span className="page-count-partial">
              {masechet.partialPages} {isHebrew ? "חלקי" : "partial"}
            </span>
            <span className="page-count-divider">&bull;</span>
            <span className="page-count-to-go">
              {masechet.notStartedPages} {isHebrew ? "נותרו" : "to go"}
            </span>
            <span className="page-count-divider">&bull;</span>
            <span>
              {masechet.totalPages} {isHebrew ? "דפים סה״כ" : "pages total"}
            </span>
            <span className="page-count-divider">&bull;</span>
            <span>
              {masechet.translatedComments.toLocaleString()} /{" "}
              {masechet.totalComments.toLocaleString()}{" "}
              {isHebrew ? "פירושים" : "comments"} ({masechet.percentTranslatedComments}%)
            </span>
          </div>
        ) : (
          <div className="masechet-page-counts">
            <span>
              {masechet.totalPages} {isHebrew ? "דפים" : "pages"}
            </span>
            <span className="page-count-divider">&bull;</span>
            <span className="page-count-no-comments">
              {isHebrew
                ? "אין פירושי רש״י או תוספות (לא נכלל בספירה)"
                : "No Rashi/Tosafot comments (excluded from totals)"}
            </span>
          </div>
        )}

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

const SORT_OPTION_LABELS: Record<
  TranslationProgressSortOption,
  {english: string; hebrew: string}
> = {
  traditional: {english: "Traditional Order", hebrew: "סדר הש״ס המקורי"},
  percent_descending: {
    english: "% Complete (Highest First)",
    hebrew: "% הושלם (מהגבוה לנמוך)",
  },
  percent_ascending: {
    english: "% Complete (Lowest First)",
    hebrew: "% הושלם (מהנמוך לגבוה)",
  },
  complete_pages_descending: {
    english: "Most Complete Pages",
    hebrew: "מספר דפים שהושלמו",
  },
  total_pages_descending: {
    english: "Total Pages",
    hebrew: "גודל המסכת (דפים)",
  },
  alphabetical: {
    english: "Alphabetical",
    hebrew: "סדר א״ב (אנגלית)",
  },
};

export function TranslationProgressDashboard({
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
  const [sortOption, setSortOption] = React.useState<TranslationProgressSortOption>(
    translationProgressSortOrder,
  );
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
    const firstHasComments = hasTranslatableComments(firstMasechet);
    const secondHasComments = hasTranslatableComments(secondMasechet);
    if (
      (sortOption === "percent_descending"
        || sortOption === "percent_ascending"
        || sortOption === "complete_pages_descending")
      && firstHasComments !== secondHasComments
    ) {
      return firstHasComments ? -1 : 1;
    }

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

  const effectiveSummary = progressData.masechtot.length > 0
    ? computeProgressSummary(progressData.masechtot, progressData.summary.updatedAt)
    : progressData.summary;

  const handleSortOptionChange = (nextSortOption: TranslationProgressSortOption) => {
    translationProgressSortOrderPreference.set(nextSortOption);
    setSortOption(nextSortOption);
  };

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
          <div className="translation-dashboard-badge">
            <span className="metric-pill" />
            <span>Talmud Bavli Project</span>
          </div>
          <h1 className="translation-dashboard-title">
            {isHebrew ? "התקדמות תרגום רש״י ותוספות" : "Rashi & Tosafot Translation Progress"}
          </h1>
          <p className="translation-dashboard-subtitle">
            {isHebrew
              ? "מעקב מקיף אחר השלמת תרגום פירושי רש״י ותוספות לש״ס בבלי לאנגלית"
              : "Comprehensive tracking of English translations across Talmud Bavli"}
          </p>
        </div>

        <SummaryCards summary={effectiveSummary} isHebrew={isHebrew} />

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
                placeholder={isHebrew ? "חפש מסכת..." : "Search tractate by name..."}
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
              />
            </div>

            <div className="sort-select-wrapper">
              <span>{isHebrew ? "מיין לפי:" : "Sort by:"}</span>
              <select
                className="sort-select"
                value={sortOption}
                onChange={event => handleSortOptionChange(
                  event.target.value as TranslationProgressSortOption,
                )}>
                {TRANSLATION_PROGRESS_SORT_OPTIONS.map(option => (
                  <option key={option} value={option}>
                    {isHebrew
                      ? SORT_OPTION_LABELS[option].hebrew
                      : SORT_OPTION_LABELS[option].english}
                  </option>
                ))}
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
