// Page geometry. All internal layout math is done in CSS pixels (96 per inch); documents store
// dimensions in the user's chosen unit so that "6 x 9 in" round-trips exactly.

export type LengthUnit = "mm" | "in";

export const PX_PER_INCH = 96;
export const MM_PER_INCH = 25.4;

export function toPx(value: number, unit: LengthUnit): number {
  return unit === "in" ? value * PX_PER_INCH : (value / MM_PER_INCH) * PX_PER_INCH;
}

export function fromPx(px: number, unit: LengthUnit): number {
  return unit === "in" ? px / PX_PER_INCH : (px / PX_PER_INCH) * MM_PER_INCH;
}

export interface Margins {
  top: number;
  bottom: number;
  // Inner = binding side ("gutter"); outer = fore-edge. Which physical side is inner depends on
  // the page's parity and the binding direction.
  inner: number;
  outer: number;
}

export type BindingDirection = "rtl" | "ltr";

export interface PageSettings {
  preset: string;
  unit: LengthUnit;
  width: number;
  height: number;
  margins: Margins;
  // Hebrew books bind on the right: the first page is a left-hand page.
  binding: BindingDirection;
}

export interface PagePreset {
  id: string;
  label: string;
  unit: LengthUnit;
  width: number;
  height: number;
}

export const PAGE_PRESETS: PagePreset[] = [
  {id: "pocket", label: "Pocket (4.25 × 6.875 in)", unit: "in", width: 4.25, height: 6.875},
  {id: "a6", label: "A6 (105 × 148 mm)", unit: "mm", width: 105, height: 148},
  {id: "digest", label: "Digest (5.5 × 8.5 in)", unit: "in", width: 5.5, height: 8.5},
  {id: "a5", label: "A5 (148 × 210 mm)", unit: "mm", width: 148, height: 210},
  {id: "trade", label: "Trade (6 × 9 in)", unit: "in", width: 6, height: 9},
  {id: "royal", label: "Royal (6.75 × 9.625 in)", unit: "in", width: 6.75, height: 9.625},
  {id: "crown-quarto", label: "Crown quarto (7.44 × 9.69 in)", unit: "in", width: 7.44, height: 9.69},
  {id: "letter", label: "US Letter (8.5 × 11 in)", unit: "in", width: 8.5, height: 11},
  {id: "a4", label: "A4 (210 × 297 mm)", unit: "mm", width: 210, height: 297},
  {id: "folio", label: "Folio (9 × 12 in)", unit: "in", width: 9, height: 12},
];

export function presetById(id: string): PagePreset | undefined {
  return PAGE_PRESETS.find(x => x.id === id);
}

function roundTo(x: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(x * factor) / factor;
}

export function convertMargins(margins: Margins, from: LengthUnit, to: LengthUnit): Margins {
  if (from === to) return {...margins};
  const convert = (x: number) => roundTo(fromPx(toPx(x, from), to), to === "mm" ? 1 : 3);
  return {
    top: convert(margins.top),
    bottom: convert(margins.bottom),
    inner: convert(margins.inner),
    outer: convert(margins.outer),
  };
}

export function pageSettingsFromPreset(
  presetId: string,
  margins: Margins,
  binding: BindingDirection = "rtl",
): PageSettings {
  const preset = presetById(presetId);
  if (!preset) throw new Error(`Unknown page preset: ${presetId}`);
  return {
    preset: preset.id,
    unit: preset.unit,
    width: preset.width,
    height: preset.height,
    margins: convertMargins(margins, "in", preset.unit),
    binding,
  };
}

export interface PageBox {
  widthPx: number;
  heightPx: number;
  contentWidthPx: number;
  contentHeightPx: number;
  // Physical left/right margins for a given page index.
  marginsFor(pageIndex: number): {top: number; bottom: number; left: number; right: number};
}

/**
 * Whether the page at `pageIndex` (0-based, in reading order) sits on the left side of a spread.
 *
 * For a right-bound (Hebrew) book the first page is a left-hand page; for a left-bound book the
 * first page is a right-hand page (a recto).
 */
export function isLeftHandPage(pageIndex: number, binding: BindingDirection): boolean {
  const even = pageIndex % 2 === 0;
  return binding === "rtl" ? even : !even;
}

export function pageBox(settings: PageSettings): PageBox {
  const px = (x: number) => toPx(x, settings.unit);
  const {margins} = settings;
  const widthPx = px(settings.width);
  const heightPx = px(settings.height);
  return {
    widthPx,
    heightPx,
    contentWidthPx: widthPx - px(margins.inner) - px(margins.outer),
    contentHeightPx: heightPx - px(margins.top) - px(margins.bottom),
    marginsFor(pageIndex: number) {
      // The inner margin is on the right of a left-hand page and on the left of a right-hand page.
      const left = isLeftHandPage(pageIndex, settings.binding);
      return {
        top: px(margins.top),
        bottom: px(margins.bottom),
        left: left ? px(margins.outer) : px(margins.inner),
        right: left ? px(margins.inner) : px(margins.outer),
      };
    },
  };
}

export function cssLength(value: number, unit: LengthUnit): string {
  return `${value}${unit}`;
}
