import * as React from "react";
import {useEffect, useMemo, useState} from "react";
import {MikraotChapter} from "../model/dataTypes";
import {applyCuration, buildCurationRequest, setCommentOverride} from "../model/curation";
import {
  CommentOverride,
  CONTINUATION_HEADING_FORMATS,
  CommentatorConfig,
  ENGLISH_MODES,
  EnglishMode,
  LabelStyle,
  MainEnglishMode,
  MikraotDocument,
  MikraotSection,
  SectionRange,
  Tier,
  defaultSection,
  newId,
} from "../model/documents";
import {parshiyotForBook, sectionBounds, sectionLabel} from "../model/sections";
import {fontsForScript} from "../model/fonts";
import {
  AvailableSource,
  COMMENTATORS,
  TANAKH_BOOKS,
  resolveCommentator,
  sefariaCommentatorId,
  tanakhBook,
} from "../model/mikraotCommentators";
import {NumberInput, PageSettingsEditor} from "./Chrome";

type Update = (updater: (doc: MikraotDocument) => MikraotDocument) => void;
type SectionUpdate = (updater: (section: MikraotSection) => MikraotSection) => void;

function commentatorName(doc: MikraotDocument, section: MikraotSection, id: string): string {
  const config = section.commentators.find(x => x.id === id) ?? {id};
  const resolved = resolveCommentator(config, doc.book);
  return (doc.hebrewOnly ? resolved?.hebrewName : resolved?.englishName) ?? id;
}

function findComment(chapters: MikraotChapter[] | undefined, ref: string) {
  for (const chapter of chapters ?? []) {
    for (const [id, commentary] of Object.entries(chapter.commentaries)) {
      for (let v = 0; v < commentary.verses.length; v++) {
        const comment = commentary.verses[v].find(x => x.ref === ref);
        if (comment) return {commentator: id, verse: `${chapter.chapter}:${v + 1}`, comment};
      }
    }
  }
  return undefined;
}

function downloadFile(name: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, undefined, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function pickFile(): Promise<string> {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", () => input.files?.[0]?.text().then(resolve));
    input.click();
  });
}

function CurationPanel({
  doc, update, section, sectionIndex, chapters, selectedRef, setSelectedRef,
}: {
  doc: MikraotDocument;
  update: Update;
  section: MikraotSection;
  sectionIndex: number;
  chapters?: MikraotChapter[];
  selectedRef?: string;
  setSelectedRef: (ref: string | undefined) => void;
}) {
  const selected = selectedRef ? findComment(chapters, selectedRef) : undefined;
  const override = selectedRef ? doc.commentOverrides[selectedRef] ?? {} : {};
  const overrides = Object.entries(doc.commentOverrides);
  const set = (change: CommentOverride) => update(x => setCommentOverride(x, selectedRef!, change));

  const importCuration = async () => {
    try {
      const {doc: next, warnings} = applyCuration(doc, sectionIndex, JSON.parse(await pickFile()));
      update(() => next);
      if (warnings.length > 0) {
        // eslint-disable-next-line no-alert
        alert(`Imported with warnings:\n${warnings.join("\n")}`);
      }
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(String(e));
    }
  };

  return (
    <>
      <h3>Curation</h3>
      {selected
        ? (
          <>
            <div className="hint">
              {commentatorName(doc, section, selected.commentator)} · {selected.verse}
              {" · "}
              <button onClick={() => setSelectedRef(undefined)}>deselect</button>
            </div>
            <div className="word-chips rtl" style={{maxHeight: 90}}>
              {selected.comment.he.replace(/<[^>]+>/g, "").slice(0, 220)}
            </div>
            <div className="row">
              <span>Show</span>
              <select
                value={override.hidden ? "hidden" : String(override.tier ?? "")}
                onChange={e => {
                  const {value} = e.target;
                  if (value === "hidden") set({hidden: true, tier: undefined});
                  else set({hidden: undefined, tier: value ? parseInt(value) as Tier : undefined});
                }}>
                <option value="">(commentator default)</option>
                <option value="1">Primary</option>
                <option value="2">Secondary</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            <div className="row">
              <span>Max lines (then addendum)</span>
              <input
                type="number"
                step={1}
                min={0}
                style={{width: 64}}
                value={override.maxLines ?? ""}
                placeholder="inherit"
                onChange={e => {
                  const parsed = parseInt(e.target.value);
                  set({maxLines: Number.isNaN(parsed) ? undefined : parsed});
                }} />
            </div>
            {doc.hebrewOnly ? null : (
              <div className="row">
                <span>English</span>
                <select
                  value={override.showEnglish === undefined ? "" : String(override.showEnglish)}
                  onChange={e => set({showEnglish: e.target.value === "" ? undefined : e.target.value === "true"})}>
                  <option value="">(commentator default)</option>
                  <option value="true">Show</option>
                  <option value="false">Hide</option>
                </select>
              </div>
            )}
          </>
        )
        : <div className="hint">Click a comment on a page to hide it or change its prominence.</div>}
      <div className="hint">{overrides.length} comment override{overrides.length === 1 ? "" : "s"}</div>
      <div className="button-row">
        <button
          onClick={() => chapters && downloadFile(
            `curation-request-${doc.book}-${sectionLabel(doc, section, false)}.json`,
            buildCurationRequest(doc, section, chapters))}
          title="Inventory of every comment, for an automated curation tool">
          Export comments
        </button>
        <button onClick={importCuration} title="Apply a curation file (kind: mikraot-curation)">
          Import curation
        </button>
        <button
          disabled={overrides.length === 0}
          onClick={() => update(x => ({...x, commentOverrides: {}}))}>
          Clear overrides
        </button>
      </div>
    </>
  );
}

function Row({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div className="row">
      <span>{label}</span>
      {children}
    </div>
  );
}

function FontSelect({value, onChange, script, general}: {
  value?: string;
  onChange: (value: string | undefined) => void;
  script: "hebrew" | "latin";
  // Label for the "use the general setting" choice; omit to require a font.
  general?: string;
}) {
  return (
    <select value={value ?? ""} onChange={e => onChange(e.target.value || undefined)}>
      {general !== undefined ? <option value="">{general}</option> : null}
      {fontsForScript(script).map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
    </select>
  );
}

function OptionalSize({value, onChange, placeholder}: {
  value?: number;
  onChange: (value: number | undefined) => void;
  placeholder: string;
}) {
  return (
    <input
      type="number"
      step={0.2}
      style={{width: 64}}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={e => {
        const parsed = parseFloat(e.target.value);
        onChange(Number.isNaN(parsed) ? undefined : parsed);
      }} />
  );
}

const TIERS: {id: Tier; label: string}[] = [
  {id: 1, label: "Primary"},
  {id: 2, label: "Secondary"},
];

function CommentatorRow({doc, config, index, updateSection}: {
  doc: MikraotDocument;
  config: CommentatorConfig;
  index: number;
  updateSection: SectionUpdate;
}) {
  const [open, setOpen] = useState(false);
  const resolved = resolveCommentator(config, doc.book);
  const set = (change: Partial<CommentatorConfig>) => updateSection(x => ({
    ...x,
    commentators: x.commentators.map(c => (c.id === config.id ? {...c, ...change} : c)),
  }));
  const move = (delta: number) => updateSection(x => {
    const active = x.commentators.filter(c => c.tier > 0);
    const target = active[active.findIndex(c => c.id === config.id) + delta];
    if (!target) return x;
    const list = x.commentators.slice();
    const a = list.findIndex(c => c.id === config.id);
    const b = list.findIndex(c => c.id === target.id);
    [list[a], list[b]] = [list[b], list[a]];
    return {...x, commentators: list};
  });
  const generalSize = config.tier === 1 ? doc.typography.tier1SizePt : doc.typography.tier2SizePt;
  return (
    <div className="commentator-row">
      <div className="commentator-head">
        <button className="link" onClick={() => setOpen(!open)} title="Fonts and sizes">
          {open ? "▾" : "▸"}
        </button>
        <span className="name">
          {doc.hebrewOnly ? null : `${resolved?.englishName ?? config.id} `}
          <span className={doc.hebrewOnly ? "" : "hint"}>{resolved?.hebrewName}</span>
        </span>
        <button onClick={() => move(-1)} title="Move up" disabled={index === 0}>↑</button>
        <button onClick={() => move(1)} title="Move down">↓</button>
        <button onClick={() => set({tier: 0})} title="Remove">×</button>
      </div>
      <div className="commentator-controls">
        <select value={config.tier} onChange={e => set({tier: parseInt(e.target.value) as Tier})}>
          {TIERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        {doc.hebrewOnly ? null : (
          <select
            value={config.english}
            onChange={e => set({english: e.target.value as EnglishMode})}>
            {ENGLISH_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        )}
      </div>
      {config.english === "side-by-side" && !doc.hebrewOnly
        ? (
          <div className="hint">
            <label htmlFor={`wrap-${config.id}`}>
              <input
                type="checkbox"
                id={`wrap-${config.id}`}
                checked={Boolean(config.wrap)}
                onChange={e => set({wrap: e.target.checked})} />
              Wrap the English around the Hebrew
            </label>
          </div>
        ) : null}
      {open
        ? (
          <div className="commentator-details">
            <Row label="Hebrew font">
              <FontSelect value={config.font} script="hebrew" general="(general)" onChange={font => set({font})} />
            </Row>
            <Row label="Hebrew size (pt)">
              <OptionalSize
                value={config.sizePt}
                placeholder={String(generalSize)}
                onChange={sizePt => set({sizePt})} />
            </Row>
            <Row label="Max lines (then addendum)">
              <OptionalSize
                value={config.maxLines}
                placeholder={doc.layout.maxCommentLines ? String(doc.layout.maxCommentLines) : "none"}
                onChange={maxLines => set({maxLines})} />
            </Row>
            {doc.hebrewOnly ? null : (
              <>
                <Row label="English font">
                  <FontSelect
                    value={config.englishFont}
                    script="latin"
                    general="(general)"
                    onChange={englishFont => set({englishFont})} />
                </Row>
                <Row label="English size (pt)">
                  <OptionalSize
                    value={config.englishSizePt}
                    placeholder={String(config.english === "footnote" ? doc.typography.notesSizePt : doc.typography.englishSizePt)}
                    onChange={englishSizePt => set({englishSizePt})} />
                </Row>
              </>
            )}
          </div>
        ) : null}
    </div>
  );
}

const sourcesCache = new Map<string, Promise<AvailableSource[]>>();

function fetchSources(book: string, chapter: number): Promise<AvailableSource[]> {
  const key = `${book}/${chapter}`;
  if (!sourcesCache.has(key)) {
    const promise = fetch(`/api/print/mikraot-sources/${encodeURIComponent(book)}/${chapter}`)
      .then(response => (response.ok ? response.json() : []))
      .catch(() => []);
    sourcesCache.set(key, promise);
  }
  return sourcesCache.get(key)!;
}

/** Search and add any commentary available for this chapter on Sefaria. */
function AddCommentary({doc, section, updateSection}: {
  doc: MikraotDocument;
  section: MikraotSection;
  updateSection: SectionUpdate;
}) {
  const [query, setQuery] = useState("");
  const [sources, setSources] = useState<AvailableSource[]>([]);
  const [probeError, setProbeError] = useState<string>();
  const chapter = sectionBounds(doc.book, section.range).startChapter;
  useEffect(() => {
    fetchSources(doc.book, chapter).then(setSources);
  }, [doc.book, chapter]);

  // Registry commentators first (they have tuned defaults), then everything Sefaria links.
  const candidates = useMemo(() => {
    const active = new Set(section.commentators.filter(x => x.tier > 0).map(x => x.id));
    const registry = section.commentators
      .filter(x => x.tier === 0 && COMMENTATORS.some(c => c.id === x.id && !c.isTargum))
      .map(x => resolveCommentator(x, doc.book)!);
    const registryPrefixes = new Set(registry.map(x => x.refPrefix));
    const dynamic = sources
      .filter(x => !registryPrefixes.has(x.refPrefix))
      .map(x => ({
        id: sefariaCommentatorId(x.refPrefix),
        englishName: x.englishName,
        hebrewName: x.hebrewName,
        refPrefix: x.refPrefix,
        isTargum: false,
      }));
    return [...registry, ...dynamic].filter(x => !active.has(x.id));
  }, [section.commentators, doc.book, sources]);

  const lower = query.trim().toLowerCase();
  const matches = candidates.filter(x => !lower
    || x.englishName.toLowerCase().includes(lower)
    || x.hebrewName.includes(query.trim())
    || x.refPrefix.toLowerCase().includes(lower));

  type Candidate = {id: string; englishName: string; hebrewName: string; refPrefix: string};
  const add = (candidate: Candidate) => {
    updateSection(x => {
      const existing = x.commentators.find(c => c.id === candidate.id);
      const others = x.commentators.filter(c => c.id !== candidate.id);
      const config: CommentatorConfig = existing
        ? {...existing, tier: 2}
        : {
          id: candidate.id,
          refPrefix: candidate.refPrefix,
          englishName: candidate.englishName,
          hebrewName: candidate.hebrewName,
          tier: 2,
          english: "none",
        };
      // Newly added commentators go after the active ones.
      const lastActive = others.map(c => c.tier > 0).lastIndexOf(true);
      const commentators = [
        ...others.slice(0, lastActive + 1), config, ...others.slice(lastActive + 1)];
      return {...x, commentators};
    });
    setQuery("");
  };

  const addByTitle = async () => {
    setProbeError(undefined);
    const title = query.trim();
    // Accept "Abarbanel on Torah, Genesis" (chapter appended) or a full prefix.
    const prefix = /\s$/.test(query) || /\d$/.test(title) ? query : `${title} `;
    const response = await fetch(`/api/print/mikraot-probe/${chapter}?p=${encodeURIComponent(prefix)}`);
    const json = await response.json();
    if (!response.ok) {
      setProbeError(json.error ?? "Not found");
      return;
    }
    add({id: sefariaCommentatorId(json.refPrefix), ...json});
  };

  return (
    <div className="add-commentary">
      <input
        value={query}
        placeholder={`Add a commentary (${candidates.length} available)…`}
        onChange={e => setQuery(e.target.value)} />
      {query
        ? (
          <div className="add-list">
            {matches.slice(0, 40).map(x => (
              <button key={x.id} className="link" onClick={() => add(x)}>
                {doc.hebrewOnly ? x.hebrewName : <>{x.englishName} <span className="hint">{x.hebrewName}</span></>}
              </button>
            ))}
            <button className="link" onClick={addByTitle} title="Fetch this Sefaria title by chapter">
              Load “{query.trim()} {chapter}” from Sefaria…
            </button>
            {probeError ? <div className="print-error">{probeError}</div> : null}
          </div>
        ) : null}
    </div>
  );
}

interface TranslationVersion {
  versionTitle: string;
  label: string;
  language: string;
}

const versionsCache = new Map<string, Promise<TranslationVersion[]>>();

function TranslationSelect({doc, update}: {doc: MikraotDocument; update: Update}) {
  const [versions, setVersions] = useState<TranslationVersion[]>([]);
  useEffect(() => {
    if (!versionsCache.has(doc.book)) {
      versionsCache.set(doc.book, fetch(`/api/print/versions/${encodeURIComponent(doc.book)}`)
        .then(response => (response.ok ? response.json() : []))
        .catch(() => []));
    }
    versionsCache.get(doc.book)!.then(setVersions);
  }, [doc.book]);
  return (
    <select
      value={doc.translationVersion ?? ""}
      onChange={e => update(x => ({...x, translationVersion: e.target.value || undefined}))}>
      <option value="">(Sefaria default)</option>
      {versions.map(x => (
        <option key={x.versionTitle} value={x.versionTitle}>
          {x.label}{x.language !== "en" ? ` [${x.language}]` : ""}
        </option>
      ))}
    </select>
  );
}

function LabelStyleEditor({title, value, onChange}: {
  title: string;
  value: LabelStyle;
  onChange: (value: LabelStyle) => void;
}) {
  const set = (change: Partial<LabelStyle>) => onChange({...value, ...change});
  return (
    <details className="label-style">
      <summary>{title}</summary>
      <Row label="Font">
        <FontSelect value={value.font} script="hebrew" general="(same as text)" onChange={font => set({font})} />
      </Row>
      <Row label="Size (× text)">
        <NumberInput value={value.scale} step={0.05} onChange={scale => set({scale})} />
      </Row>
      <Row label="Color">
        <input type="color" value={value.color} onChange={e => set({color: e.target.value})} />
      </Row>
      <Row label="Bold">
        <input type="checkbox" checked={value.bold} onChange={e => set({bold: e.target.checked})} />
      </Row>
      <Row label="Raised (superscript)">
        <input type="checkbox" checked={value.superscript} onChange={e => set({superscript: e.target.checked})} />
      </Row>
      <Row label="Prefix">
        <input
          value={value.prefix}
          style={{width: 80}}
          onChange={e => set({prefix: e.target.value})} />
      </Row>
      <Row label="Suffix">
        <input
          value={value.suffix}
          style={{width: 80}}
          onChange={e => set({suffix: e.target.value})} />
      </Row>
      <Row label="Numerals">
        <select value={value.numerals} onChange={e => set({numerals: e.target.value as LabelStyle["numerals"]})}>
          <option value="hebrew">Hebrew (א, ב, ג)</option>
          <option value="arabic">Arabic (1, 2, 3)</option>
        </select>
      </Row>
    </details>
  );
}

const MAIN_ENGLISH: {id: MainEnglishMode; label: string}[] = [
  {id: "notes", label: "In the notes"},
  {id: "side-by-side", label: "Side by side"},
  {id: "stacked", label: "Below the Hebrew"},
  {id: "none", label: "None"},
];

/** Choosing which section is being edited, and adding, duplicating, reordering or removing them. */
function SectionsEditor({doc, update, activeSection, setActiveSection}: {
  doc: MikraotDocument;
  update: Update;
  activeSection: number;
  setActiveSection: (index: number) => void;
}) {
  const section = doc.sections[activeSection];
  const setSections = (sections: MikraotSection[], active: number) => {
    update(x => ({...x, sections}));
    setActiveSection(active);
  };
  const move = (delta: number) => {
    const target = activeSection + delta;
    if (target < 0 || target >= doc.sections.length) return;
    const list = doc.sections.slice();
    [list[activeSection], list[target]] = [list[target], list[activeSection]];
    setSections(list, target);
  };
  return (
    <>
      <div className="section-tabs">
        {doc.sections.map((x, i) => (
          <button
            key={x.id}
            className={i === activeSection ? "active" : ""}
            onClick={() => setActiveSection(i)}
            title={x.showMainText ? "" : "Without the source text"}>
            {i + 1}. {sectionLabel(doc, x, true)}{x.showMainText ? "" : " ✱"}
          </button>
        ))}
      </div>
      <div className="button-row">
        <button
          onClick={() => setSections(
            [...doc.sections, defaultSection(doc.book, section.range)], doc.sections.length)}>
          + New
        </button>
        <button
          onClick={() => setSections(
            [...doc.sections, {...section, id: newId("section"), title: undefined}], doc.sections.length)}
          title="Repeat this range (e.g. again with more commentaries)">
          Duplicate
        </button>
        <button onClick={() => move(-1)} disabled={activeSection === 0}>↑</button>
        <button onClick={() => move(1)} disabled={activeSection === doc.sections.length - 1}>
          ↓
        </button>
        <button
          disabled={doc.sections.length === 1}
          onClick={() => setSections(
            doc.sections.filter((_, i) => i !== activeSection), Math.max(0, activeSection - 1))}>
          Remove
        </button>
      </div>
    </>
  );
}

function RangeEditor({doc, section, updateSection}: {
  doc: MikraotDocument;
  section: MikraotSection;
  updateSection: SectionUpdate;
}) {
  const info = tanakhBook(doc.book);
  const parshiyot = parshiyotForBook(doc.book);
  const {range} = section;
  const setRange = (next: SectionRange) => updateSection(x => ({...x, range: next}));
  return (
    <>
      {parshiyot.length > 0
        ? (
          <Row label="Split by">
            <select
              value={range.kind}
              onChange={e => setRange(e.target.value === "parsha"
                ? {kind: "parsha", parsha: parshiyot[0].id}
                : {kind: "chapters", startChapter: 1, endChapter: 1})}>
              <option value="chapters">Chapters</option>
              <option value="parsha">Parsha</option>
            </select>
          </Row>
        ) : null}
      {range.kind === "parsha"
        ? (
          <Row label="Parsha">
            <select value={range.parsha} onChange={e => setRange({kind: "parsha", parsha: e.target.value})}>
              {parshiyot.map(x => (
                <option key={x.id} value={x.id}>
                  {doc.hebrewOnly ? x.hebrewName : `${x.name} · ${x.hebrewName}`}
                </option>
              ))}
            </select>
          </Row>
        )
        : (
          <Row label="Chapters">
            <span>
              <NumberInput
                value={range.startChapter}
                step={1}
                min={1}
                max={info?.chapters}
                onChange={v => setRange({kind: "chapters", startChapter: v, endChapter: Math.max(v, range.endChapter)})} />
              {" – "}
              <NumberInput
                value={range.endChapter}
                step={1}
                min={range.startChapter}
                max={info?.chapters}
                onChange={v => setRange({...range, endChapter: Math.max(range.startChapter, v)})} />
            </span>
          </Row>
        )}
    </>
  );
}

const LINE_HEIGHTS: [keyof MikraotDocument["typography"], string][] = [
  ["mainLineHeight", "Main text"],
  ["targumLineHeight", "Targum"],
  ["mainEnglishLineHeight", "Verse translation"],
  ["lineHeight", "Commentary"],
  ["commentaryEnglishLineHeight", "Commentary English"],
  ["notesLineHeight", "Notes"],
  ["headingLineHeight", "Commentary headings"],
];

export function MikraotSettings({
  doc, update, activeSection, setActiveSection, chapters, selectedRef, setSelectedRef,
}: {
  doc: MikraotDocument;
  update: Update;
  activeSection: number;
  setActiveSection: (index: number) => void;
  chapters?: MikraotChapter[];
  selectedRef?: string;
  setSelectedRef: (ref: string | undefined) => void;
}): React.ReactElement {
  const section = doc.sections[activeSection];
  const english = !doc.hebrewOnly;
  const presetHeading = CONTINUATION_HEADING_FORMATS.some(
    x => x.template === doc.layout.continuationHeading);
  const setTypography = (key: keyof MikraotDocument["typography"], value: any) => (
    update(x => ({...x, typography: {...x.typography, [key]: value}})));
  const setLayout = (key: keyof MikraotDocument["layout"], value: any) => (
    update(x => ({...x, layout: {...x.layout, [key]: value}})));
  const updateSection: SectionUpdate = updater => update(x => ({
    ...x,
    sections: x.sections.map((s, i) => (i === activeSection ? updater(s) : s)),
  }));
  const active = section.commentators.filter(
    x => x.tier > 0 && !resolveCommentator(x, doc.book)?.isTargum);
  const isTorah = tanakhBook(doc.book)?.section === "Torah";

  return (
    <div className="print-panel no-print">
      <Row label="Hebrew only (no English anywhere)">
        <input type="checkbox" checked={doc.hebrewOnly} onChange={e => update(x => ({...x, hebrewOnly: e.target.checked}))} />
      </Row>

      <h3>{english ? "Book" : "ספר"}</h3>
      <Row label={english ? "Book" : "ספר"}>
        <select
          value={doc.book}
          onChange={e => {
            const book = e.target.value;
            update(x => ({
              ...x, book, sections: [defaultSection(book)], translationVersion: undefined,
            }));
            setActiveSection(0);
          }}>
          {TANAKH_BOOKS.map(x => (
            <option key={x.name} value={x.name}>{english ? `${x.name} · ${x.hebrewName}` : x.hebrewName}</option>
          ))}
        </select>
      </Row>
      {english
        ? (
          <Row label="Translation">
            <TranslationSelect doc={doc} update={update} />
          </Row>
        ) : null}
      <Row label="Trope (cantillation)">
        <input type="checkbox" checked={doc.typography.showTrope} onChange={e => setTypography("showTrope", e.target.checked)} />
      </Row>
      <Row label="Targum beside the text">
        <input type="checkbox" checked={doc.layout.showTargum} onChange={e => setLayout("showTargum", e.target.checked)} />
      </Row>
      {isTorah
        ? (
          <Row label="Label aliyot">
            <input type="checkbox" checked={doc.showAliyot} onChange={e => update(x => ({...x, showAliyot: e.target.checked}))} />
          </Row>
        ) : null}

      <h3>Sections</h3>
      <div className="hint">
        Each section renders a range of the book; repeat a range to show it again with other
        commentaries.
      </div>
      <SectionsEditor
        doc={doc}
        update={update}
        activeSection={activeSection}
        setActiveSection={setActiveSection} />
      <div className="section-box">
        <RangeEditor doc={doc} section={section} updateSection={updateSection} />
        <Row label="Title (optional)">
          <input
            value={section.title ?? ""}
            placeholder={sectionLabel(doc, {...section, title: undefined}, true)}
            onChange={e => updateSection(x => ({...x, title: e.target.value || undefined}))} />
        </Row>
        <Row label="Show the source text">
          <input
            type="checkbox"
            checked={section.showMainText}
            onChange={e => updateSection(x => ({...x, showMainText: e.target.checked}))} />
        </Row>
        {english && section.showMainText
          ? (
            <Row label="Translation placement">
              <select
                value={section.mainEnglish ?? doc.layout.mainEnglish}
                onChange={e => {
                  const mainEnglish = e.target.value as MainEnglishMode;
                  updateSection(x => ({...x, mainEnglish}));
                }}>
                {MAIN_ENGLISH.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </Row>
          ) : null}

        <h3>Commentaries</h3>
        <div className="hint">Order sets the reading order. Primary commentaries are set larger, in fewer columns.</div>
        {active.map((config, index) => (
          <CommentatorRow
            key={config.id}
            doc={doc}
            config={config}
            index={index}
            updateSection={updateSection} />
        ))}
        <AddCommentary doc={doc} section={section} updateSection={updateSection} />
      </div>

      <CurationPanel
        doc={doc}
        update={update}
        section={section}
        sectionIndex={activeSection}
        chapters={chapters}
        selectedRef={selectedRef}
        setSelectedRef={setSelectedRef} />

      {english
        ? (
          <>
            <h3>English labels</h3>
            {([
              ["runningHead", "Running heads"],
              ["chapterHeadings", "Chapter headings in the translation"],
              ["sectionTitles", "Section titles"],
              ["continuations", "Continuations title"],
              ["notes", "Note labels (else Hebrew names)"],
            ] as const).map(([key, label]) => (
              <Row label={label} key={key}>
                <input
                  type="checkbox"
                  checked={doc.englishLabels[key]}
                  onChange={e => {
                    const {checked} = e.target;
                    update(x => ({...x, englishLabels: {...x.englishLabels, [key]: checked}}));
                  }} />
              </Row>
            ))}
          </>
        ) : null}

      <h3>Verse and chapter markers</h3>
      <LabelStyleEditor
        title="Verse numbers in the text"
        value={doc.typography.verseLabel}
        onChange={v => setTypography("verseLabel", v)} />
      <LabelStyleEditor
        title="Verse labels in commentary"
        value={doc.typography.commentLabel}
        onChange={v => setTypography("commentLabel", v)} />
      <LabelStyleEditor
        title="Chapter headings"
        value={doc.typography.chapterLabel}
        onChange={v => setTypography("chapterLabel", v)} />

      <h3>Page</h3>
      <PageSettingsEditor page={doc.page} onChange={page => update(x => ({...x, page}))} />

      <h3>General typography</h3>
      <div className="hint">Used for every commentary that doesn&apos;t set its own.</div>
      <Row label="Main text font">
        <FontSelect value={doc.typography.mainFont} script="hebrew" onChange={font => setTypography("mainFont", font)} />
      </Row>
      <Row label="Commentary font">
        <FontSelect
          value={doc.typography.commentaryFont}
          script="hebrew"
          onChange={font => setTypography("commentaryFont", font)} />
      </Row>
      {english
        ? (
          <>
            <Row label="English font">
              <FontSelect value={doc.typography.englishFont} script="latin" onChange={font => setTypography("englishFont", font)} />
            </Row>
            <Row label="Notes font">
              <FontSelect value={doc.typography.notesFont} script="latin" onChange={font => setTypography("notesFont", font)} />
            </Row>
          </>
        ) : null}
      {([
        ["mainSizePt", "Main text size (pt)", false],
        ["tier1SizePt", "Primary commentary (pt)", false],
        ["tier2SizePt", "Secondary commentary (pt)", false],
        ["englishSizePt", "Commentary English (pt)", true],
        ["targumSizePt", "Targum (pt)", false],
        ["notesSizePt", "Notes (pt)", true],
      ] as const).filter(entry => english || !entry[2]).map(([key, label]) => (
        <Row label={label} key={key}>
          <NumberInput
            value={doc.typography[key]}
            step={0.2}
            onChange={v => setTypography(key, v)} />
        </Row>
      ))}

      <h3>Line heights</h3>
      {LINE_HEIGHTS
        .filter(([key]) => english || !["mainEnglishLineHeight", "commentaryEnglishLineHeight", "notesLineHeight"].includes(key))
        .map(([key, label]) => (
          <Row label={label} key={key}>
            <NumberInput
              value={doc.typography[key] as number}
              step={0.05}
              onChange={v => setTypography(key, v)} />
          </Row>
        ))}
      {english
        ? (
          <Row label="Align side-by-side verse translation lines">
            <input
              type="checkbox"
              checked={doc.typography.alignMainLines}
              onChange={e => setTypography("alignMainLines", e.target.checked)} />
          </Row>
        ) : null}
      {english && doc.typography.alignMainLines
        ? (
          <div className="hint">
            Aligned side-by-side lines share one line pitch: the larger of the main text&apos;s
            and the verse translation&apos;s.
          </div>
        ) : null}

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
        ["maxCommentLines", "Max lines per comment (0 = none)", 1],
      ] as const).map(([key, label, step]) => (
        <Row label={label} key={key}>
          <NumberInput
            value={doc.layout[key] as number}
            step={step}
            onChange={v => setLayout(key, v)} />
        </Row>
      ))}
      <Row label="Column rules">
        <input type="checkbox" checked={doc.layout.columnRules} onChange={e => setLayout("columnRules", e.target.checked)} />
      </Row>

      <h3>Continuations</h3>
      <Row label="Heading format">
        <select
          value={presetHeading ? doc.layout.continuationHeading : "custom"}
          onChange={e => {
            if (e.target.value !== "custom") setLayout("continuationHeading", e.target.value);
          }}>
          {CONTINUATION_HEADING_FORMATS.map(x => (
            <option key={x.template} value={x.template}>{x.label}</option>
          ))}
          <option value="custom">Custom…</option>
        </select>
      </Row>
      <Row label="Heading template">
        <input
          type="text"
          dir="rtl"
          value={doc.layout.continuationHeading}
          title="{n} number, {name} commentator, {ref} פרק א׳ פסוק י״א, {cv} א:י״א, {page} page"
          onChange={e => setLayout("continuationHeading", e.target.value)} />
      </Row>
      {english
        ? (
          <Row label="Point to translations in the continuations">
            <input
              type="checkbox"
              checked={doc.layout.continuationTranslationRefs}
              onChange={e => setLayout("continuationTranslationRefs", e.target.checked)} />
          </Row>
        ) : null}
    </div>
  );
}
