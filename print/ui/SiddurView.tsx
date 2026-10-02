import * as React from "react";
import {useEffect, useMemo, useState} from "react";
import {SiddurSectionData} from "../model/dataTypes";
import {SiddurDocument} from "../model/documents";
import {fontFamily} from "../model/fonts";
import {isLeftHandPage} from "../model/geometry";
import {SIDDUR_EDITIONS} from "../model/siddurEditions";
import {SiddurUnit, buildSiddurUnits} from "../model/siddurModel";
import {Selection} from "../model/siddurEdits";
import {SiddurLayout, SdFragment, SdPage, paginateSiddur} from "../layout/siddurPaginator";
import {
  PageFrame,
  PagesView,
  Toolbar,
  ViewMode,
  parseStyle,
  usePageRule,
  usePersistentState,
} from "./Chrome";
import {isHeadless, loadFonts, reportPrintError, useDocument} from "./documentHooks";
import {SiddurPanel} from "./SiddurPanel";

const sectionCache = new Map<string, Promise<SiddurSectionData>>();

export function fetchSection(edition: string, id: string): Promise<SiddurSectionData> {
  const key = `${edition}|${id}`;
  if (!sectionCache.has(key)) {
    const url = `/api/print/siddur/${encodeURIComponent(edition)}/section?id=${encodeURIComponent(id)}`;
    const promise = fetch(url).then(async response => {
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? response.statusText);
      return json as SiddurSectionData;
    });
    promise.catch(() => sectionCache.delete(key));
    sectionCache.set(key, promise);
  }
  return sectionCache.get(key)!;
}

function Fragment({fragment, width}: {fragment?: SdFragment; width: number}) {
  if (!fragment) return <div style={{width}} />;
  return (
    <div
      className={fragment.className}
      dir={fragment.dir}
      lang={fragment.lang}
      style={{
        ...parseStyle(fragment.style ?? ""),
        width,
        height: fragment.height,
        display: "flow-root",
        flexShrink: 0,
      }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{__html: fragment.html}} />
  );
}

function SiddurPageContent({page, layout}: {page: SdPage; layout: SiddurLayout}) {
  const g = layout.geometry;
  return (
    <>
      <div style={{height: g.headerHeight, flexShrink: 0}}>
        <div className="sd-head">
          <span className="he">{page.headerHebrew}</span>
          <span className="en">{page.headerEnglish}</span>
        </div>
      </div>
      <div style={{height: g.headerGap, flexShrink: 0}} />
      {page.rows.map(row => (
        <div
          key={row.key}
          className={`sd-row ${row.pair ? "pair" : ""}`}
          style={{marginTop: row.spaceBefore, height: row.height}}>
          {row.pair
            ? (
              <>
                <Fragment fragment={row.lanes[0]} width={g.hebrewWidth} />
                <Fragment fragment={row.lanes[1]} width={g.englishWidth} />
              </>
            )
            : <Fragment fragment={row.lanes[0]} width={g.contentWidth} />}
        </div>
      ))}
      <div style={{flex: 1}} />
      {page.notes.length > 0
        ? (
          <div style={{flexShrink: 0}}>
            <div style={{height: g.notesRuleHeight, display: "flex", alignItems: "center"}}>
              <div className="sd-notes-rule" />
            </div>
            <div style={{height: page.notesHeight}}>
              {page.notes.map(note => (
                <Fragment key={note.key} fragment={note} width={g.contentWidth} />
              ))}
            </div>
          </div>
        ) : null}
      <div style={{height: g.footerGap, flexShrink: 0}} />
      <div className="sd-foot" style={{height: g.footerHeight, flexShrink: 0}}>{page.index + 1}</div>
    </>
  );
}

/** One language's page of a facing spread. Rows keep their heights so both pages line up. */
function FacingPageContent({page, layout, lang, number}: {
  page: SdPage;
  layout: SiddurLayout;
  lang: "he" | "en";
  number: number;
}) {
  const g = layout.geometry;
  const lane = lang === "he" ? 0 : 1;
  return (
    <>
      <div style={{height: g.headerHeight, flexShrink: 0}}>
        <div className="sd-head">
          {lang === "he"
            ? <span className="he" style={{marginInlineStart: "auto"}}>{page.headerHebrew}</span>
            : <span className="en">{page.headerEnglish}</span>}
        </div>
      </div>
      <div style={{height: g.headerGap, flexShrink: 0}} />
      {page.rows.map(row => (
        <div key={row.key} className="sd-row" style={{marginTop: row.spaceBefore, height: row.height}}>
          <Fragment fragment={row.lanes[lane]} width={g.contentWidth} />
        </div>
      ))}
      <div style={{flex: 1}} />
      {lang === "en" && page.notes.length > 0
        ? (
          <div style={{flexShrink: 0}}>
            <div style={{height: g.notesRuleHeight, display: "flex", alignItems: "center"}}>
              <div className="sd-notes-rule" />
            </div>
            <div style={{height: page.notesHeight}}>
              {page.notes.map(note => (
                <Fragment key={note.key} fragment={note} width={g.contentWidth} />
              ))}
            </div>
          </div>
        ) : null}
      <div style={{height: g.footerGap, flexShrink: 0}} />
      <div className="sd-foot" style={{height: g.footerHeight, flexShrink: 0}}>{number}</div>
    </>
  );
}

function TitlePageContent({doc}: {doc: SiddurDocument}) {
  const edition = SIDDUR_EDITIONS.find(x => x.id === doc.edition);
  return (
    <div className="sd-title-page">
      <div className="he">{edition?.titleHebrew}</div>
      <div className="en">{doc.name}</div>
    </div>
  );
}

export function SiddurView(): React.ReactElement {
  const {doc, error, update, replace, saving} = useDocument<SiddurDocument>("siddur");
  const [sections, setSections] = useState<Map<string, SiddurSectionData>>();
  const [dataError, setDataError] = useState<string>();
  const [layout, setLayout] = useState<SiddurLayout>();
  const [units, setUnits] = useState<SiddurUnit[]>([]);
  const [viewMode, setViewMode] = usePersistentState<ViewMode>("print:viewMode", "spreads");
  const [zoom, setZoom] = usePersistentState<number>("print:zoom", 1);
  const [selection, setSelection] = useState<Selection>();
  const [showMargins, setShowMargins] = useState(false);

  usePageRule(doc?.page ?? {width: 5.5, height: 8.5, unit: "in"} as any);

  const sectionsKey = doc ? `${doc.edition}|${doc.sections.join("|")}` : "";
  useEffect(() => {
    if (!doc) return;
    setDataError(undefined);
    Promise.all(doc.sections.map(id => fetchSection(doc.edition, id).then(x => [id, x] as const)))
      .then(entries => setSections(new Map(entries)))
      .catch(e => setDataError(reportPrintError(e)));
  }, [sectionsKey]);

  const layoutKey = doc ? JSON.stringify({...doc, name: "", updatedAt: 0}) : "";
  useEffect(() => {
    if (!doc || !sections) return undefined;
    let cancelled = false;
    const families = [doc.typography.hebrewFont, doc.typography.englishFont, "noto-sans-hebrew"]
      .map(fontFamily)
      .map(x => x.split(",")[0]);
    loadFonts(families).then(() => {
      if (cancelled) return;
      const built = buildSiddurUnits(doc, sections);
      const result = paginateSiddur(doc, built.units);
      setUnits(built.units);
      setLayout(result);
      window.__PRINT_STATS__ = {
        ...result.stats,
        pages: result.facing ? 2 * result.pages.length + 1 : result.pages.length,
      };
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        window.__PRINT_READY__ = true;
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [layoutKey, sections]);

  // Map piece keys to their location, for click-to-select.
  const pieceLocations = useMemo(() => {
    const result = new Map<string, Selection>();
    for (const unit of units) {
      if (unit.kind !== "row") continue;
      for (const key of unit.pieces) {
        const hash = key.lastIndexOf("#");
        result.set(key, {
          ref: key.slice(0, hash),
          pieceIndex: parseInt(key.slice(hash + 1)),
          sectionId: unit.sectionId,
          paragraphKey: unit.paragraphKey,
        });
      }
    }
    return result;
  }, [units]);

  const onPagesClick = (event: React.MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-k]");
    if (!target) return;
    const location = pieceLocations.get(target.dataset.k!);
    if (location) setSelection(location);
  };

  if (error) return <div className="print-status print-error">{error}</div>;
  if (!doc) return <div className="print-status">Loading…</div>;

  const selectedKey = selection ? `${selection.ref}#${selection.pieceIndex}` : undefined;
  const editing = !isHeadless();

  const frame = (index: number, content: React.ReactElement) => (
    <PageFrame
      key={index}
      size={{widthPx: layout!.geometry.widthPx, heightPx: layout!.geometry.heightPx}}
      margins={layout!.marginsFor(index)}
      className={`siddur ${editing ? "editing" : ""}`}
      style={layout!.cssVars}
      showMargins={showMargins}>
      {content}
    </PageFrame>
  );

  let pages: React.ReactElement[] = [];
  if (layout && !layout.facing) {
    pages = layout.pages.map(page => (
      frame(page.index, <SiddurPageContent page={page} layout={layout} />)));
  } else if (layout) {
    // A title page first, so that each logical page becomes a two-page spread.
    pages = [frame(0, <TitlePageContent doc={doc} />)];
    layout.pages.forEach((page, k) => {
      for (const index of [2 * k + 1, 2 * k + 2]) {
        const side = isLeftHandPage(index, doc.page.binding) ? "left" : "right";
        const lang = side === doc.facingHebrewSide ? "he" : "en";
        pages.push(frame(index, (
          <FacingPageContent page={page} layout={layout} lang={lang} number={index + 1} />
        )));
      }
    });
  }

  const status = layout
    ? `${pages.length} pages · ${layout.stats.millis} ms`
    : (dataError ? "" : "Loading text…");

  return (
    <>
      {selectedKey
        ? (
          <style>
            {`.siddur [data-k="${CSS.escape(selectedKey)}"] { background: rgba(232, 200, 120, 0.45); }
              @media print { .siddur [data-k] { background: none !important; } }`}
          </style>
        ) : null}
      <Toolbar
        kind="siddur"
        doc={doc}
        saving={saving}
        status={status}
        onRename={name => update(x => ({...x, name}))}
        onReplace={replace}
        viewMode={viewMode}
        setViewMode={setViewMode}
        zoom={zoom}
        setZoom={setZoom}>
        <span className="hint">
          <input type="checkbox" checked={showMargins} onChange={e => setShowMargins(e.target.checked)} />
          {" margins"}
        </span>
      </Toolbar>
      <div className="print-workspace">
        {/* eslint-disable-next-line max-len */}
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
        <div className="print-pages" onClick={onPagesClick}>
          {dataError ? <div className="print-status print-error">{dataError}</div> : null}
          {layout
            ? (
              <PagesView
                pages={pages}
                size={layout.geometry}
                binding={doc.page.binding}
                viewMode={viewMode}
                zoom={zoom} />
            )
            : (dataError ? null : <div className="print-status">Laying out pages…</div>)}
        </div>
        <SiddurPanel
          doc={doc}
          update={update}
          sections={sections}
          selection={selection}
          setSelection={setSelection} />
      </div>
    </>
  );
}
