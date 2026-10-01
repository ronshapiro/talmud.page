// Pure edit operations on siddur documents, used by the editor panel.

// splitEn is serialized to JSON, where `undefined` can't hold a place in an array.
/* eslint-disable unicorn/no-null */

import {
  LayoutOptions,
  SegmentOverride,
  SiddurCommentaryNote,
  SiddurDocument,
} from "./documents";
import {InlineStyle, StyleRange} from "./richText";

export type Scope = "piece" | "segment" | "paragraph" | "section" | "document";

export interface Selection {
  ref: string;
  pieceIndex: number;
  sectionId: string;
  paragraphKey: string;
}

function withSegment(
  doc: SiddurDocument,
  ref: string,
  change: (override: SegmentOverride) => SegmentOverride,
): SiddurDocument {
  const next = change({...(doc.segmentOverrides[ref] ?? {})});
  const segmentOverrides = {...doc.segmentOverrides};
  if (Object.keys(next).length === 0) {
    delete segmentOverrides[ref];
  } else {
    segmentOverrides[ref] = next;
  }
  return {...doc, segmentOverrides};
}

function clean<T extends Record<string, any>>(value: T): T {
  const result: any = {};
  for (const [key, v] of Object.entries(value)) {
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    result[key] = v;
  }
  return result;
}

export function layoutAt(doc: SiddurDocument, selection: Selection, scope: Scope): LayoutOptions {
  switch (scope) {
    case "piece":
      return doc.segmentOverrides[selection.ref]?.pieces?.[selection.pieceIndex] ?? {};
    case "segment":
      return doc.segmentOverrides[selection.ref] ?? {};
    case "paragraph":
      return doc.paragraphOverrides[selection.paragraphKey] ?? {};
    case "section":
      return doc.sectionOverrides[selection.sectionId] ?? {};
    case "document":
    default:
      return doc.defaults;
  }
}

export function setLayoutAt(
  doc: SiddurDocument,
  selection: Selection,
  scope: Scope,
  change: LayoutOptions,
): SiddurDocument {
  const apply = (current: LayoutOptions | undefined) => clean({...(current ?? {}), ...change});
  switch (scope) {
    case "piece":
      return withSegment(doc, selection.ref, override => {
        const pieces = {...(override.pieces ?? {})};
        const value = apply(pieces[selection.pieceIndex]);
        if (Object.keys(value).length === 0) {
          delete pieces[selection.pieceIndex];
        } else {
          pieces[selection.pieceIndex] = value;
        }
        return clean({...override, pieces});
      });
    case "segment":
      return withSegment(doc, selection.ref, override => apply(override));
    case "paragraph": {
      const paragraphOverrides = {...doc.paragraphOverrides};
      const key = selection.paragraphKey;
      paragraphOverrides[key] = apply(paragraphOverrides[key]);
      return {...doc, paragraphOverrides};
    }
    case "section": {
      const sectionOverrides = {...doc.sectionOverrides};
      sectionOverrides[selection.sectionId] = apply(sectionOverrides[selection.sectionId]);
      return {...doc, sectionOverrides};
    }
    case "document":
    default:
      return {...doc, defaults: {...doc.defaults, ...change}};
  }
}

/** Adds or removes a split point (Hebrew token index). Keeps splitEn aligned with splitHe. */
export function toggleSplit(doc: SiddurDocument, ref: string, heIndex: number): SiddurDocument {
  return withSegment(doc, ref, override => {
    const he = override.splitHe ?? [];
    const en = override.splitEn ?? he.map(() => null);
    const existing = he.indexOf(heIndex);
    let pairs = he.map((x, i) => [x, en[i] ?? null] as [number, number | null]);
    if (existing === -1) {
      pairs.push([heIndex, null]);
    } else {
      pairs = pairs.filter((_, i) => i !== existing);
    }
    pairs.sort((a, b) => a[0] - b[0]);
    // Piece overrides are positional; they may shift when splits change, which is acceptable.
    return clean({
      ...override,
      splitHe: pairs.map(x => x[0]),
      splitEn: pairs.some(x => x[1] !== null) ? pairs.map(x => x[1]) : undefined,
    });
  });
}

export function setEnglishSplit(
  doc: SiddurDocument,
  ref: string,
  splitNumber: number,
  enIndex: number | null,
): SiddurDocument {
  return withSegment(doc, ref, override => {
    const he = override.splitHe ?? [];
    const en = he.map((_, i) => override.splitEn?.[i] ?? null);
    en[splitNumber] = enIndex;
    return clean({...override, splitEn: en.some(x => x !== null) ? en : undefined});
  });
}

export function toggleBreak(
  doc: SiddurDocument,
  ref: string,
  lang: "he" | "en",
  index: number,
): SiddurDocument {
  const key = lang === "he" ? "breaksHe" : "breaksEn";
  return withSegment(doc, ref, override => {
    const breaks = override[key] ?? [];
    const next = breaks.includes(index)
      ? breaks.filter(x => x !== index)
      : [...breaks, index].sort((a, b) => a - b);
    return clean({...override, [key]: next});
  });
}

export function addStyle(
  doc: SiddurDocument,
  ref: string,
  lang: "he" | "en",
  start: number,
  end: number,
  style: InlineStyle,
): SiddurDocument {
  const key = lang === "he" ? "stylesHe" : "stylesEn";
  return withSegment(doc, ref, override => clean({
    ...override,
    [key]: [...(override[key] ?? []), {start, end, style}],
  }));
}

/** Removes styling from [start, end), trimming ranges that extend beyond it. */
export function clearStyles(
  doc: SiddurDocument,
  ref: string,
  lang: "he" | "en",
  start: number,
  end: number,
): SiddurDocument {
  const key = lang === "he" ? "stylesHe" : "stylesEn";
  return withSegment(doc, ref, override => {
    const result: StyleRange[] = [];
    for (const range of override[key] ?? []) {
      if (range.end <= start || range.start >= end) {
        result.push(range);
        continue;
      }
      if (range.start < start) result.push({...range, end: start});
      if (range.end > end) result.push({...range, start: end});
    }
    return clean({...override, [key]: result});
  });
}

export function setTextOverride(
  doc: SiddurDocument,
  ref: string,
  lang: "he" | "en",
  html: string | undefined,
): SiddurDocument {
  const key = lang === "he" ? "heOverride" : "enOverride";
  return withSegment(doc, ref, override => clean({...override, [key]: html || undefined}));
}

export function setCommentary(
  doc: SiddurDocument,
  ref: string,
  type: string,
  html: string,
): SiddurDocument {
  const others = (doc.commentary[ref] ?? []).filter(x => x.type !== type);
  const notes: SiddurCommentaryNote[] = html.trim() ? [...others, {type, html}] : others;
  const commentary = {...doc.commentary};
  if (notes.length === 0) {
    delete commentary[ref];
  } else {
    commentary[ref] = notes;
  }
  return {...doc, commentary};
}

export function resetSegment(doc: SiddurDocument, ref: string): SiddurDocument {
  const segmentOverrides = {...doc.segmentOverrides};
  delete segmentOverrides[ref];
  return {...doc, segmentOverrides};
}
