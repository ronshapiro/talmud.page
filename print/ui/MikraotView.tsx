import * as React from "react";
import {useEffect, useState} from "react";
import {MikraotChapter} from "../model/dataTypes";
import {CommentatorConfig, MikraotDocument, Tier, defaultCommentatorConfigs} from "../model/documents";
import {fontFamily, fontsForScript} from "../model/fonts";
import {COMMENTATORS_BY_ID, TANAKH_BOOKS, tanakhBook} from "../model/mikraotCommentators";
import {MikraotLayout, MgPage, RegionLayout, RenderedFragment, paginateMikraot} from "../layout/mikraotPaginator";
import {
  NumberInput,
  PageFrame,
  PageSettingsEditor,
  PagesView,
  Toolbar,
  ViewMode,
  parseStyle,
  usePageRule,
  usePersistentState,
} from "./Chrome";
import {loadFonts, useDocument} from "./documentHooks";

const chapterCache = new Map<string, Promise<MikraotChapter>>();

function fetchChapter(
  book: string,
  chapter: number,
  commentators: string[],
): Promise<MikraotChapter> {
  const key = `${book}/${chapter}?c=${commentators.slice().sort().join(",")}`;
  if (!chapterCache.has(key)) {
    const url = `/api/print/mikraot/${encodeURIComponent(book)}/${chapter}?c=${commentators.join(",")}`;
    const promise = fetch(url).then(async response => {
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? response.statusText);
      return json as MikraotChapter;
    });
    promise.catch(() => chapterCache.delete(key));
    chapterCache.set(key, promise);
  }
  return chapterCache.get(key)!;
}

function neededCommentators(doc: MikraotDocument): string[] {
  return doc.commentators
    .filter(x => x.tier > 0 || (COMMENTATORS_BY_ID[x.id]?.isTargum && doc.layout.showTargum))
    .map(x => x.id);
}

function Fragment({fragment}: {fragment: RenderedFragment}) {
  return (
    <div
      className={fragment.className}
      dir={fragment.dir}
      lang={fragment.lang}
      style={{...parseStyle(fragment.style ?? ""), marginTop: fragment.spaceBefore, height: fragment.height, display: "flow-root"}}
      dangerouslySetInnerHTML={{__html: fragment.html}} />
  );
}

function Region({region, gap, rules}: {region: RegionLayout; gap: number; rules: boolean}) {
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
      {page.mainHeight > 0
        ? (
          <div className="mg-main-area" style={{height: page.mainHeight}}>
            <div className="mg-main" style={{width: g.mainWidth}} dangerouslySetInnerHTML={{__html: page.mainHtml!}} />
            {page.targumHtml
              ? <div className="mg-targum" style={{width: g.targumWidth}} dangerouslySetInnerHTML={{__html: page.targumHtml}} />
              : null}
          </div>
        ) : null}
      {commentaryRegions.map(region => {
        const marginTop = hasAbove ? g.regionGap : 0;
        hasAbove = true;
        return (
          <div key={region.kind} style={{marginTop, flexShrink: 0}}>
            <Region region={region} gap={gap} rules={doc.layout.columnRules} />
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
            <Region region={notes} gap={gap} rules={false} />
          </div>
        ) : null}
      <div style={{height: g.footerGap, flexShrink: 0}} />
      <div className="mg-foot" style={{height: g.footerHeight, flexShrink: 0}}>{page.index + 1}</div>
    </>
  );
}

const TIER_LABELS: Record<Tier, string> = {0: "Off", 1: "Primary", 2: "Secondary"};

function MikraotSettings({doc, update}: {
  doc: MikraotDocument;
  update: (updater: (doc: MikraotDocument) => MikraotDocument) => void;
}) {
  const info = tanakhBook(doc.book);
  const setTypography = (key: keyof MikraotDocument["typography"], value: any) => (
    update(x => ({...x, typography: {...x.typography, [key]: value}})));
  const setLayout = (key: keyof MikraotDocument["layout"], value: any) => (
    update(x => ({...x, layout: {...x.layout, [key]: value}})));
  const setCommentator = (id: string, change: Partial<CommentatorConfig>) => update(x => ({
    ...x,
    commentators: x.commentators.map(c => (c.id === id ? {...c, ...change} : c)),
  }));
  const move = (index: number, delta: number) => update(x => {
    const list = x.commentators.slice();
    const target = index + delta;
    if (target < 0 || target >= list.length) return x;
    [list[index], list[target]] = [list[target], list[index]];
    return {...x, commentators: list};
  });

  return (
    <div className="print-panel no-print">
      <h3>Text</h3>
      <div className="row">
        <span>Book</span>
        <select
          value={doc.book}
          onChange={e => {
            const book = e.target.value;
            const commentators = defaultCommentatorConfigs(book);
            update(x => ({...x, book, startChapter: 1, endChapter: 1, commentators}));
          }}>
          {TANAKH_BOOKS.map(x => (
            <option key={x.name} value={x.name}>{x.name} · {x.hebrewName}</option>
          ))}
        </select>
      </div>
      <div className="row">
        <span>Chapters</span>
        <span>
          <NumberInput
            value={doc.startChapter}
            step={1}
            min={1}
            max={info?.chapters}
            onChange={v => update(x => ({
              ...x,
              startChapter: v,
              endChapter: Math.max(v, x.endChapter),
            }))} />
          {" – "}
          <NumberInput
            value={doc.endChapter}
            step={1}
            min={doc.startChapter}
            max={info?.chapters}
            onChange={v => update(x => ({...x, endChapter: Math.max(x.startChapter, v)}))} />
        </span>
      </div>
      <div className="row">
        <span>Trope (cantillation)</span>
        <input type="checkbox" checked={doc.typography.showTrope} onChange={e => setTypography("showTrope", e.target.checked)} />
      </div>
      <div className="row">
        <span>Targum beside the text</span>
        <input type="checkbox" checked={doc.layout.showTargum} onChange={e => setLayout("showTargum", e.target.checked)} />
      </div>
      <div className="row">
        <span>Verse translation in notes</span>
        <input
          type="checkbox"
          checked={doc.layout.showVerseTranslation}
          onChange={e => setLayout("showVerseTranslation", e.target.checked)} />
      </div>

      <h3>Commentaries</h3>
      <div className="hint">Order sets the reading order. Primary commentaries are set larger, in fewer columns.</div>
      {doc.commentators.map((config, index) => {
        const commentator = COMMENTATORS_BY_ID[config.id];
        if (!commentator || commentator.isTargum) return null;
        return (
          <div key={config.id} className="row" style={{display: "flex", alignItems: "center", gap: 6, margin: "4px 0"}}>
            <span style={{flex: 1}}>{commentator.englishName} <span className="hint">{commentator.hebrewName}</span></span>
            <select
              value={config.tier}
              onChange={e => setCommentator(config.id, {tier: parseInt(e.target.value) as Tier})}>
              {([1, 2, 0] as Tier[]).map(t => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
            </select>
            <span className="hint" title="Show the English translation in the notes">
              <input
                type="checkbox"
                checked={config.showEnglish}
                disabled={config.tier === 0}
                onChange={e => setCommentator(config.id, {showEnglish: e.target.checked})} />
              EN
            </span>
            <button onClick={() => move(index, -1)} title="Move up">↑</button>
            <button onClick={() => move(index, 1)} title="Move down">↓</button>
          </div>
        );
      })}

      <h3>Page</h3>
      <PageSettingsEditor page={doc.page} onChange={page => update(x => ({...x, page}))} />

      <h3>Typography</h3>
      <div className="row">
        <span>Main text font</span>
        <select value={doc.typography.mainFont} onChange={e => setTypography("mainFont", e.target.value)}>
          {fontsForScript("hebrew").filter(x => !x.rashi).map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </div>
      <div className="row">
        <span>Commentary font</span>
        <select value={doc.typography.commentaryFont} onChange={e => setTypography("commentaryFont", e.target.value)}>
          {fontsForScript("hebrew").map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </div>
      {([
        ["mainSizePt", "Main text size (pt)"],
        ["tier1SizePt", "Primary commentary (pt)"],
        ["tier2SizePt", "Secondary commentary (pt)"],
        ["targumSizePt", "Targum (pt)"],
        ["notesSizePt", "English notes (pt)"],
        ["lineHeight", "Commentary line height"],
      ] as const).map(([key, label]) => (
        <div className="row" key={key}>
          <span>{label}</span>
          <NumberInput value={doc.typography[key]} step={key === "lineHeight" ? 0.05 : 0.2} onChange={v => setTypography(key, v)} />
        </div>
      ))}

      <h3>Layout</h3>
      {([
        ["tier1Columns", "Primary columns", 1],
        ["tier2Columns", "Secondary columns", 1],
        ["notesColumns", "Notes columns", 1],
        ["columnGapPt", "Column gap (pt)", 1],
        ["regionGapPt", "Region gap (pt)", 1],
        ["maxNotesFraction", "Max notes share of page", 0.05],
        ["maxMainFraction", "Max main text share of page", 0.05],
        ["maxCommentaryLag", "Max verses text may run ahead", 1],
        ["minPageFill", "Min page fill before continuing", 0.02],
      ] as const).map(([key, label, step]) => (
        <div className="row" key={key}>
          <span>{label}</span>
          <NumberInput
            value={doc.layout[key] as number}
            step={step}
            onChange={v => setLayout(key, v)} />
        </div>
      ))}
      <div className="row">
        <span>Column rules</span>
        <input type="checkbox" checked={doc.layout.columnRules} onChange={e => setLayout("columnRules", e.target.checked)} />
      </div>
    </div>
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

  usePageRule(doc?.page ?? {width: 8.5, height: 11, unit: "in"} as any);

  const commentatorKey = doc ? neededCommentators(doc).join(",") : "";
  useEffect(() => {
    if (!doc) return;
    setDataError(undefined);
    const ids = neededCommentators(doc);
    const requests = [];
    for (let chapter = doc.startChapter; chapter <= doc.endChapter; chapter++) {
      requests.push(fetchChapter(doc.book, chapter, ids));
    }
    Promise.all(requests).then(setChapters).catch(e => setDataError(String(e)));
  }, [doc?.book, doc?.startChapter, doc?.endChapter, commentatorKey]);

  // Re-paginate whenever the document or data changes.
  const layoutKey = doc ? JSON.stringify({...doc, name: "", updatedAt: 0}) : "";
  useEffect(() => {
    if (!doc || !chapters) return undefined;
    let cancelled = false;
    const {mainFont, commentaryFont, notesFont} = doc.typography;
    const families = [mainFont, commentaryFont, notesFont]
      .map(fontFamily)
      .map(x => x.split(",")[0]);
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

  return (
    <>
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
        <div className="print-pages">
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
        <MikraotSettings doc={doc} update={update} />
      </div>
    </>
  );
}
