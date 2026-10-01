// App chrome shared by both layouts: toolbar with document management, page viewer and the page
// frame. None of this is printed.

import * as React from "react";
import {useEffect, useState} from "react";
import {DocumentKind, PrintDocument, newId} from "../model/documents";
import {
  BindingDirection,
  Margins,
  PAGE_PRESETS,
  PageSettings,
  convertMargins,
  cssLength,
  isLeftHandPage,
  presetById,
} from "../model/geometry";
import {documentStore} from "../store/documentStore";
import {downloadJson, isHeadless, newDocument, pickJsonFile} from "./documentHooks";

interface ToolbarProps<T extends PrintDocument> {
  kind: DocumentKind;
  doc: T;
  saving: boolean;
  status?: string;
  onRename: (name: string) => void;
  onReplace: (doc: T) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  children?: React.ReactNode;
}

export type ViewMode = "spreads" | "single" | "flip";

const ZOOM_LEVELS = [0.5, 0.65, 0.8, 1, 1.25, 1.5, 2];

export function Toolbar<T extends PrintDocument>(props: ToolbarProps<T>): React.ReactElement {
  const {kind, doc} = props;
  const [others, setOthers] = useState<PrintDocument[]>([]);

  useEffect(() => {
    if (isHeadless()) return;
    documentStore.list(kind).then(setOthers);
  }, [kind, doc.id, doc.name]);

  const switchTo = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("doc", id);
    window.location.href = url.toString();
  };

  const duplicate = async () => {
    const copy = {...doc, id: newId(kind), name: `${doc.name} (copy)`, createdAt: Date.now(), updatedAt: Date.now()};
    await documentStore.put(copy);
    switchTo(copy.id);
  };

  const create = async () => {
    const created = newDocument(kind);
    created.name = kind === "siddur" ? "New Siddur" : "New Mikraot Gedolot";
    await documentStore.put(created);
    switchTo(created.id);
  };

  const importDoc = async () => {
    const imported = await pickJsonFile();
    if (imported.kind !== kind) {
      // eslint-disable-next-line no-alert
      alert(`That file is a ${imported.kind} document.`);
      return;
    }
    const exists = await documentStore.get(imported.id);
    const toSave = exists ? {...imported, id: newId(kind)} : imported;
    await documentStore.put(toSave);
    switchTo(toSave.id);
  };

  const deleteDoc = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${doc.name}"? This can't be undone.`)) return;
    await documentStore.delete(doc.id);
    const remaining = others.filter(x => x.id !== doc.id);
    if (remaining.length > 0) {
      switchTo(remaining[0].id);
    } else {
      window.location.href = window.location.pathname;
    }
  };

  return (
    <div className="print-toolbar no-print">
      <a className="title" href="/print">{kind === "siddur" ? "Siddur" : "Mikraot Gedolot"}</a>
      <select value={doc.id} onChange={e => switchTo(e.target.value)} title="Switch document">
        {others.some(x => x.id === doc.id) ? null : <option value={doc.id}>{doc.name}</option>}
        {others.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <input
        value={doc.name}
        onChange={e => props.onRename(e.target.value)}
        style={{width: 160}}
        title="Document name" />
      <button onClick={create} title="New document">New</button>
      <button onClick={duplicate} title="Duplicate this document">Duplicate</button>
      <button onClick={() => downloadJson(doc)} title="Export as JSON (also the input of the PDF CLI)">Export</button>
      <button onClick={importDoc} title="Import a JSON document">Import</button>
      <button onClick={deleteDoc} title="Delete this document">Delete</button>
      <span className="hint">{props.saving ? "Saving…" : "Saved"}</span>
      {props.children}
      <span className="spacer" />
      {props.status ? <span className="hint">{props.status}</span> : null}
      <select value={props.viewMode} onChange={e => props.setViewMode(e.target.value as ViewMode)}>
        <option value="spreads">Spreads</option>
        <option value="single">Single pages</option>
        <option value="flip">One spread at a time</option>
      </select>
      <select value={props.zoom} onChange={e => props.setZoom(parseFloat(e.target.value))}>
        {ZOOM_LEVELS.map(x => <option key={x} value={x}>{Math.round(x * 100)}%</option>)}
      </select>
      <button className="primary" onClick={() => window.print()}>Print / PDF</button>
    </div>
  );
}

export interface PageSize {
  widthPx: number;
  heightPx: number;
}

/** Lays out page elements as spreads (facing pages) or as a single column. */
export function PagesView(props: {
  pages: React.ReactElement[];
  size: PageSize;
  binding: BindingDirection;
  viewMode: ViewMode;
  zoom: number;
}): React.ReactElement {
  const {pages, size, binding, viewMode, zoom} = props;
  const [current, setCurrent] = useState(0);
  const wrapped = pages.map((page, i) => (
    // Pages are positional; their index is their identity.
    // eslint-disable-next-line react/no-array-index-key
    <div className="page-wrapper" key={i}>
      {page}
      <div className="page-label">{i + 1}</div>
    </div>
  ));

  const pageCount = pages.length;
  let spreadCount = 0;
  const shown = Math.min(current, Math.max(0, Math.ceil((pageCount + 1) / 2) - 1));

  useEffect(() => {
    if (viewMode !== "flip") return undefined;
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).closest("input, textarea, select")) return;
      // Turning a page forward moves leftward in a right-bound (Hebrew) book.
      const forward = binding === "rtl" ? "ArrowLeft" : "ArrowRight";
      const back = binding === "rtl" ? "ArrowRight" : "ArrowLeft";
      if (event.key === forward) setCurrent(x => x + 1);
      if (event.key === back) setCurrent(x => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewMode, binding]);

  let content: React.ReactElement;
  if (viewMode === "single") {
    content = <div className="single-pages">{wrapped}</div>;
  } else {
    // Pages are grouped into facing spreads; the first page stands alone (like a book opening).
    const spreads: {pages: React.ReactElement[]; firstIndex: number}[] = [];
    let currentSpread: React.ReactElement[] = [];
    let firstIndex = 0;
    wrapped.forEach((page, i) => {
      if (currentSpread.length === 0) firstIndex = i;
      currentSpread.push(page);
      // A spread ends with its left-hand page for right-bound books, its right-hand page otherwise.
      const left = isLeftHandPage(i, binding);
      if (binding === "rtl" ? left : !left) {
        spreads.push({pages: currentSpread, firstIndex});
        currentSpread = [];
      }
    });
    if (currentSpread.length > 0) spreads.push({pages: currentSpread, firstIndex});
    spreadCount = spreads.length;
    content = (
      <div>
        {spreads.map((spread, i) => {
          // A lone page sits on its own side of the spread.
          const loneLeft = spread.pages.length === 1 && isLeftHandPage(spread.firstIndex, binding);
          const justify = spread.pages.length > 1
            ? "center"
            : ((binding === "rtl") === loneLeft ? "flex-end" : "flex-start");
          return (
            <div
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              className={`spread ${binding} ${viewMode === "flip" && i !== shown ? "flip-hidden" : ""}`}
              style={{justifyContent: justify, width: size.widthPx * 2}}>
              {spread.pages}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      {viewMode === "flip"
        ? (
          <div className="flip-nav no-print">
            <button disabled={shown === 0} onClick={() => setCurrent(Math.max(0, shown - 1))}>
              Back
            </button>
            <span>{`Spread ${shown + 1} of ${spreadCount}`}</span>
            <button disabled={shown >= spreadCount - 1} onClick={() => setCurrent(shown + 1)}>
              Forward
            </button>
            <span className="hint">{binding === "rtl" ? "← forward · → back" : "→ forward · ← back"}</span>
          </div>
        ) : null}
      <div className="zoom-container" style={{transform: zoom === 1 ? undefined : `scale(${zoom})`}}>
        {content}
      </div>
    </>
  );
}

/** Converts "a: b; c: d" to a React style object (supports custom properties). */
export function parseStyle(style: string): React.CSSProperties {
  const result: Record<string, string> = {};
  for (const declaration of style.split(";")) {
    const index = declaration.indexOf(":");
    if (index === -1) continue;
    const property = declaration.slice(0, index).trim();
    const value = declaration.slice(index + 1).trim();
    if (!property) continue;
    const key = property.startsWith("--")
      ? property
      : property.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    result[key] = value;
  }
  return result as React.CSSProperties;
}

export function PageFrame(props: {
  size: PageSize;
  margins: {top: number; bottom: number; left: number; right: number};
  className: string;
  style?: string;
  children: React.ReactNode;
  showMargins?: boolean;
}): React.ReactElement {
  const {size, margins} = props;
  return (
    <div
      className={`page print-root ${props.className}`}
      style={{width: size.widthPx, height: size.heightPx, ...parseStyle(props.style ?? "")}}>
      {props.showMargins
        ? (
          <div
            className="no-print"
            style={{
              position: "absolute",
              top: margins.top,
              left: margins.left,
              width: size.widthPx - margins.left - margins.right,
              height: size.heightPx - margins.top - margins.bottom,
              outline: "1px dashed rgba(80, 120, 200, 0.35)",
              pointerEvents: "none",
            }} />
        ) : null}
      <div
        className="page-content"
        style={{
          top: margins.top,
          left: margins.left,
          width: size.widthPx - margins.left - margins.right,
          height: size.heightPx - margins.top - margins.bottom,
        }}>
        {props.children}
      </div>
    </div>
  );
}

/** Injects an @page rule matching the document's page size, so browser printing is exact. */
export function usePageRule(page: PageSettings): void {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `@page { size: ${cssLength(page.width, page.unit)} ${cssLength(page.height, page.unit)}; margin: 0; }`;
    document.head.append(style);
    return () => style.remove();
  }, [page.width, page.height, page.unit]);
}

export function NumberInput(props: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
}): React.ReactElement {
  const [text, setText] = useState(String(props.value));
  useEffect(() => setText(String(props.value)), [props.value]);
  return (
    <input
      type="number"
      value={text}
      step={props.step ?? 0.1}
      min={props.min}
      max={props.max}
      onChange={e => {
        setText(e.target.value);
        const parsed = parseFloat(e.target.value);
        if (!Number.isNaN(parsed)) props.onChange(parsed);
      }} />
  );
}

export function PageSettingsEditor(props: {
  page: PageSettings;
  onChange: (page: PageSettings) => void;
}): React.ReactElement {
  const {page, onChange} = props;
  const setMargin = (key: keyof Margins, value: number) => (
    onChange({...page, margins: {...page.margins, [key]: value}}));
  return (
    <>
      <div className="row">
        <span>Page size</span>
        <select
          value={page.preset}
          onChange={e => {
            const id = e.target.value;
            if (id === "custom") {
              onChange({...page, preset: "custom"});
              return;
            }
            const preset = presetById(id)!;
            onChange({
              ...page,
              preset: id,
              unit: preset.unit,
              width: preset.width,
              height: preset.height,
              margins: convertMargins(page.margins, page.unit, preset.unit),
            });
          }}>
          {PAGE_PRESETS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
          <option value="custom">Custom…</option>
        </select>
      </div>
      <div className="row">
        <span>Width × height ({page.unit})</span>
        <span>
          <NumberInput value={page.width} onChange={x => onChange({...page, preset: "custom", width: x})} />
          {" × "}
          <NumberInput value={page.height} onChange={x => onChange({...page, preset: "custom", height: x})} />
        </span>
      </div>
      <div className="row">
        <span>Units</span>
        <select
          value={page.unit}
          onChange={e => {
            const unit = e.target.value as PageSettings["unit"];
            const factor = unit === page.unit ? 1 : (unit === "mm" ? 25.4 : 1 / 25.4);
            const round = (x: number) => Math.round(x * factor * (unit === "mm" ? 1 : 1000)) / (unit === "mm" ? 1 : 1000);
            onChange({
              ...page,
              unit,
              width: round(page.width),
              height: round(page.height),
              margins: convertMargins(page.margins, page.unit, unit),
            });
          }}>
          <option value="in">inches</option>
          <option value="mm">millimeters</option>
        </select>
      </div>
      {(["top", "bottom", "inner", "outer"] as const).map(key => (
        <div className="row" key={key}>
          <span>{key[0].toUpperCase() + key.slice(1)} margin ({page.unit})</span>
          <NumberInput value={page.margins[key]} step={page.unit === "mm" ? 1 : 0.05} onChange={x => setMargin(key, x)} />
        </div>
      ))}
      <div className="row">
        <span>Binding</span>
        <select
          value={page.binding}
          onChange={e => onChange({...page, binding: e.target.value as BindingDirection})}>
          <option value="rtl">Right (Hebrew book)</option>
          <option value="ltr">Left (English book)</option>
        </select>
      </div>
    </>
  );
}

export function usePersistentState<T extends string | number>(
  key: string,
  initial: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    if (stored === null) return initial;
    return (typeof initial === "number" ? parseFloat(stored) : stored) as T;
  });
  return [value, (next: T) => {
    localStorage.setItem(key, String(next));
    setValue(next);
  }];
}
