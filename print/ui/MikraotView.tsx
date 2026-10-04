import * as React from "react";
import {useEffect, useState} from "react";
import {MikraotChapter} from "../model/dataTypes";
import {MikraotDocument} from "../model/documents";
import {fontFamily} from "../model/fonts";
import {COMMENTATORS_BY_ID, resolveCommentator} from "../model/mikraotCommentators";
import {
  MikraotLayout,
  MgPage,
  PairRowLayout,
  RegionLayout,
  RenderedFragment,
  paginateMikraot,
} from "../layout/mikraotPaginator";
import {
  PageFrame,
  PagesView,
  Toolbar,
  ViewMode,
  parseStyle,
  usePageRule,
  usePersistentState,
} from "./Chrome";
import {loadFonts, reportPrintError, useDocument} from "./documentHooks";
import {MikraotSettings} from "./MikraotPanel";

const chapterCache = new Map<string, Promise<MikraotChapter>>();

/** Fetches a chapter with the given commentators (by Sefaria ref prefix), keyed back by id. */
function fetchChapter(
  book: string,
  chapter: number,
  commentators: {id: string; refPrefix: string}[],
  translation?: string,
): Promise<MikraotChapter> {
  const prefixes = commentators.map(x => x.refPrefix);
  const key = `${book}/${chapter}?p=${prefixes.slice().sort().join("|")}&v=${translation ?? ""}`;
  if (!chapterCache.has(key)) {
    const query = new URLSearchParams({p: prefixes.join("|"), v: translation ?? ""});
    const url = `/api/print/mikraot/${encodeURIComponent(book)}/${chapter}?${query}`;
    const promise = fetch(url).then(async response => {
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? response.statusText);
      const result = json as MikraotChapter;
      const byId: MikraotChapter["commentaries"] = {};
      for (const commentator of commentators) {
        const commentary = result.commentaries[commentator.refPrefix];
        if (commentary) byId[commentator.id] = commentary;
      }
      return {...result, commentaries: byId};
    });
    promise.catch(() => chapterCache.delete(key));
    chapterCache.set(key, promise);
  }
  return chapterCache.get(key)!;
}

function neededCommentators(doc: MikraotDocument): {id: string; refPrefix: string}[] {
  return doc.commentators
    .filter(x => x.tier > 0 || (COMMENTATORS_BY_ID[x.id]?.isTargum && doc.layout.showTargum))
    .map(x => resolveCommentator(x, doc.book))
    .filter((x): x is NonNullable<typeof x> => x !== undefined)
    .map(x => ({id: x.id, refPrefix: x.refPrefix}));
}

/** Every font family the document uses, so they can be loaded before measuring. */
function documentFonts(doc: MikraotDocument): string[] {
  const t = doc.typography;
  const ids = [
    t.mainFont, t.commentaryFont, t.notesFont, t.englishFont,
    t.verseLabel.font, t.commentLabel.font, t.chapterLabel.font,
    ...doc.commentators.filter(x => x.tier > 0).flatMap(x => [x.font, x.englishFont]),
  ].filter((x): x is string => Boolean(x));
  return Array.from(new Set(ids)).map(x => fontFamily(x).split(",")[0]);
}

function Fragment({fragment}: {fragment: RenderedFragment}) {
  return (
    <div
      className={fragment.className}
      dir={fragment.dir}
      lang={fragment.lang}
      data-ref={fragment.ref}
      style={{
        ...parseStyle(fragment.style ?? ""),
        marginTop: fragment.spaceBefore + (fragment.offset ?? 0),
        height: fragment.height,
        display: "flow-root",
      }}
      dangerouslySetInnerHTML={{__html: fragment.html}} />
  );
}

function PairRow({row, g}: {row: PairRowLayout; g: MikraotLayout["geometry"]}) {
  if (row.span) {
    return (
      <div className="pair-row" style={{marginTop: row.spaceBefore, height: row.height}}>
        {row.lanes[0]
          ? <div style={{width: g.contentWidth}}><Fragment fragment={row.lanes[0]} /></div>
          : null}
      </div>
    );
  }
  return (
    <div className="pair-row" style={{marginTop: row.spaceBefore, height: row.height}}>
      <div style={{width: g.pairHebrewWidth}}>
        {row.lanes[0] ? <Fragment fragment={row.lanes[0]} /> : null}
      </div>
      <div style={{width: g.pairEnglishWidth}}>
        {row.lanes[1] ? <Fragment fragment={row.lanes[1]} /> : null}
      </div>
    </div>
  );
}

function Region({region, gap, rules, g}: {
  region: RegionLayout;
  gap: number;
  rules: boolean;
  g: MikraotLayout["geometry"];
}) {
  if (region.rows) {
    return (
      <div className={`region-pairs region-${region.kind}`} style={{height: region.height}}>
        {region.rows.map(row => <PairRow key={row.key} row={row} g={g} />)}
      </div>
    );
  }
  const rtl = region.kind !== "notes";
  return (
    <div
      className={`region ${rtl ? "rtl" : "ltr"} ${rules && region.kind !== "notes" ? "rules" : ""} region-${region.kind}`}
      style={{height: region.height, gap}}>
      {region.columns.map((column, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <div className="col" key={i} style={{width: region.columnWidth}}>
          {column.map(fragment => <Fragment key={fragment.key} fragment={fragment} />)}
        </div>
      ))}
    </div>
  );
}

function MainArea({page, g}: {page: MgPage; g: MikraotLayout["geometry"]}) {
  const hebrew = (
    // eslint-disable-next-line react/no-danger
    <div className="mg-main" style={{width: g.mainWidth}} dangerouslySetInnerHTML={{__html: page.mainHtml!}} />
  );
  const targum = page.targumHtml
    // eslint-disable-next-line react/no-danger
    ? <div className="mg-targum" style={{width: g.targumWidth}} dangerouslySetInnerHTML={{__html: page.targumHtml}} />
    : null;
  const english = page.englishHtml
    ? (
      <div
        className="mg-main-en"
        lang="en"
        style={{width: g.englishWidth, marginTop: g.mainEnglish === "below" ? g.stackGap : 0}}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{__html: page.englishHtml}} />
    ) : null;
  if (g.mainEnglish === "below") {
    return (
      <div className="mg-main-area below" style={{height: page.mainHeight}}>
        <div className="mg-main-area">{hebrew}{targum}</div>
        {english}
      </div>
    );
  }
  return (
    <div className="mg-main-area" style={{height: page.mainHeight}}>
      {hebrew}{targum}{english}
    </div>
  );
}

function MikraotPageContent({page, layout, doc}: {
  page: MgPage;
  layout: MikraotLayout;
  doc: MikraotDocument;
}) {
  const g = layout.geometry;
  const gap = doc.layout.columnGapPt * (96 / 72);
  const commentaryRegions = page.regions.filter(x => x.kind !== "notes");
  const notes = page.regions.find(x => x.kind === "notes");
  let hasAbove = page.mainHeight > 0;
  return (
    <>
      <div style={{height: g.headerHeight, flexShrink: 0}}>
        <div className="mg-head">
          <span className="he">{page.headerHebrew}</span>
          <span className="en">{page.headerEnglish}</span>
        </div>
      </div>
      <div style={{height: g.headerGap, flexShrink: 0}} />
      {page.titleHtml
        ? (
          <div
            style={{height: page.titleHeight, flexShrink: 0, marginBottom: g.regionGap}}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{__html: page.titleHtml}} />
        ) : null}
      {page.mainHeight > 0 ? <MainArea page={page} g={g} /> : null}
      {commentaryRegions.map(region => {
        const marginTop = hasAbove ? g.regionGap : 0;
        hasAbove = true;
        return (
          <div key={region.kind} style={{marginTop, flexShrink: 0}}>
            <Region region={region} gap={gap} rules={doc.layout.columnRules} g={g} />
          </div>
        );
      })}
      <div style={{flex: 1}} />
      {notes
        ? (
          <div style={{flexShrink: 0}}>
            <div style={{height: g.notesRuleHeight, display: "flex", alignItems: "center"}}>
              <div className="mg-notes-rule" />
            </div>
            <Region region={notes} gap={gap} rules={false} g={g} />
          </div>
        ) : null}
      <div style={{height: g.footerGap, flexShrink: 0}} />
      <div className="mg-foot" style={{height: g.footerHeight, flexShrink: 0}}>{page.index + 1}</div>
    </>
  );
}

export function MikraotView(): React.ReactElement {
  const {doc, error, update, replace, saving} = useDocument<MikraotDocument>("mikraot");
  const [chapters, setChapters] = useState<MikraotChapter[]>();
  const [dataError, setDataError] = useState<string>();
  const [layout, setLayout] = useState<MikraotLayout>();
  const [viewMode, setViewMode] = usePersistentState<ViewMode>("print:viewMode", "spreads");
  const [zoom, setZoom] = usePersistentState<number>("print:zoom", 1);
  const [showMargins, setShowMargins] = useState(false);
  const [selectedRef, setSelectedRef] = useState<string>();

  usePageRule(doc?.page ?? {width: 8.5, height: 11, unit: "in"} as any);

  const needed = doc ? neededCommentators(doc) : [];
  const commentatorKey = needed.map(x => x.refPrefix).join("|");
  useEffect(() => {
    if (!doc) return;
    setDataError(undefined);
    const requests = [];
    for (let chapter = doc.startChapter; chapter <= doc.endChapter; chapter++) {
      requests.push(fetchChapter(doc.book, chapter, needed, doc.translationVersion));
    }
    Promise.all(requests).then(setChapters).catch(e => setDataError(reportPrintError(e)));
  }, [doc?.book, doc?.startChapter, doc?.endChapter, commentatorKey, doc?.translationVersion]);

  // Re-paginate whenever the document or data changes.
  const layoutKey = doc ? JSON.stringify({...doc, name: "", updatedAt: 0}) : "";
  useEffect(() => {
    if (!doc || !chapters) return undefined;
    let cancelled = false;
    const families = documentFonts(doc);
    loadFonts(families).then(() => {
      if (cancelled) return;
      const result = paginateMikraot(doc, chapters);
      setLayout(result);
      window.__PRINT_STATS__ = {...result.stats, pages: result.pages.length};
      // Let React commit, then signal readiness to the PDF renderer.
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        window.__PRINT_READY__ = true;
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [layoutKey, chapters]);

  if (error) return <div className="print-status print-error">{error}</div>;
  if (!doc) return <div className="print-status">Loading…</div>;

  const pages = layout?.pages.map(page => (
    <PageFrame
      key={page.index}
      size={{widthPx: layout.geometry.widthPx, heightPx: layout.geometry.heightPx}}
      margins={layout.marginsFor(page.index)}
      className="mikraot"
      style={layout.cssVars}
      showMargins={showMargins}>
      <MikraotPageContent page={page} layout={layout} doc={doc} />
    </PageFrame>
  )) ?? [];

  const status = layout
    ? `${layout.pages.length} pages · ${layout.stats.comments} comments · ${layout.stats.millis} ms`
    : (dataError ? "" : "Loading text…");

  const onPagesClick = (event: React.MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-ref]");
    if (target) setSelectedRef(target.dataset.ref);
  };

  return (
    <>
      {selectedRef
        ? (
          <style>
            {`.mikraot [data-ref="${CSS.escape(selectedRef)}"] { background: rgba(232, 200, 120, 0.4); }
              @media print { .mikraot [data-ref] { background: none !important; } }`}
          </style>
        ) : null}
      <Toolbar
        kind="mikraot"
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
        <MikraotSettings
          doc={doc}
          update={update}
          chapters={chapters}
          selectedRef={selectedRef}
          setSelectedRef={setSelectedRef} />
      </div>
    </>
  );
}
