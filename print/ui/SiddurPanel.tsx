import * as React from "react";
import {useEffect, useMemo, useState} from "react";
import {SiddurSectionData, SiddurSegmentData} from "../model/dataTypes";
import {
  Align,
  HebrewBreaks,
  LayoutOptions,
  LineMode,
  SiddurDocument,
  TRANSLATION_MODES,
  TranslationMode,
} from "../model/documents";
import {fontsForScript} from "../model/fonts";
import {InlineStyle, Token, tokenize} from "../model/richText";
import {KOREN_SACKS_COMMENTARY, SIDDUR_EDITIONS} from "../model/siddurEditions";
import {effectiveCommentary, resolveOptions, segmentSplits} from "../model/siddurModel";
import {
  Scope,
  Selection,
  addStyle,
  clearStyles,
  layoutAt,
  resetCommentary,
  resetSegment,
  setCommentary,
  setEnglishSplit,
  setLayoutAt,
  setTextOverride,
  toggleBreak,
  toggleSplit,
} from "../model/siddurEdits";
import {NumberInput, PageSettingsEditor} from "./Chrome";

type Update = (updater: (doc: SiddurDocument) => SiddurDocument) => void;

const KOREN_SACKS = KOREN_SACKS_COMMENTARY;

function Row({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div className="row">
      <span>{label}</span>
      {children}
    </div>
  );
}

function OptionSelect<T extends string>(props: {
  value: T | undefined;
  options: {id: T; label: string}[];
  onChange: (value: T | undefined) => void;
  allowInherit: boolean;
}) {
  return (
    <select
      value={props.value ?? ""}
      onChange={e => props.onChange((e.target.value || undefined) as T | undefined)}>
      {props.allowInherit ? <option value="">(inherit)</option> : null}
      {props.options.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
    </select>
  );
}

function BooleanSelect(props: {
  value: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
  allowInherit: boolean;
}) {
  const value = props.value === undefined ? "" : String(props.value);
  return (
    <select
      value={value}
      onChange={e => props.onChange(e.target.value === "" ? undefined : e.target.value === "true")}>
      {props.allowInherit ? <option value="">(inherit)</option> : null}
      <option value="true">yes</option>
      <option value="false">no</option>
    </select>
  );
}

function OptionalNumber(props: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  step: number;
}) {
  return (
    <input
      type="number"
      value={props.value ?? ""}
      placeholder="inherit"
      step={props.step}
      style={{width: 72}}
      onChange={e => {
        const parsed = parseFloat(e.target.value);
        props.onChange(Number.isNaN(parsed) ? undefined : parsed);
      }} />
  );
}

const LINE_MODES: {id: LineMode; label: string}[] = [
  {id: "prose", label: "Flowing prose"},
  {id: "lines", label: "Each piece on its own line"},
];

const ALIGNS: {id: Align; label: string}[] = [
  {id: "justify", label: "Justified"},
  {id: "start", label: "Start (right for Hebrew)"},
  {id: "center", label: "Centered"},
  {id: "end", label: "End"},
];

const HEBREW_BREAKS: {id: HebrewBreaks; label: string}[] = [
  {id: "none", label: "None"},
  {id: "sentence", label: "After sentences ( . : ; )"},
  {id: "clause", label: "After clauses (also , )"},
];

export function LayoutOptionsEditor({value, onChange, allowInherit}: {
  value: LayoutOptions;
  onChange: (change: LayoutOptions) => void;
  allowInherit: boolean;
}): React.ReactElement {
  return (
    <>
      <Row label="Translation">
        <OptionSelect<TranslationMode>
          value={value.translation}
          options={TRANSLATION_MODES}
          allowInherit={allowInherit}
          onChange={translation => onChange({translation})} />
      </Row>
      <Row label="Lines">
        <OptionSelect<LineMode>
          value={value.lineMode}
          options={LINE_MODES}
          allowInherit={allowInherit}
          onChange={lineMode => onChange({lineMode})} />
      </Row>
      <Row label="Auto line breaks">
        <OptionSelect<HebrewBreaks>
          value={value.hebrewBreaks}
          options={HEBREW_BREAKS}
          allowInherit
          onChange={hebrewBreaks => onChange({hebrewBreaks})} />
      </Row>
      <Row label="Split at source lines">
        <BooleanSelect
          value={value.splitLines}
          allowInherit
          onChange={splitLines => onChange({splitLines})} />
      </Row>
      <Row label="Hebrew alignment">
        <OptionSelect<Align>
          value={value.align}
          options={ALIGNS}
          allowInherit={allowInherit}
          onChange={align => onChange({align})} />
      </Row>
      <Row label="English alignment">
        <OptionSelect<Align>
          value={value.englishAlign}
          options={ALIGNS}
          allowInherit
          onChange={englishAlign => onChange({englishAlign})} />
      </Row>
      <Row label="Indent (em)">
        <OptionalNumber value={value.indent} step={0.5} onChange={indent => onChange({indent})} />
      </Row>
      <Row label="Space before (lines)">
        <OptionalNumber
          value={value.spaceBefore}
          step={0.25}
          onChange={spaceBefore => onChange({spaceBefore})} />
      </Row>
      <Row label="Size">
        <OptionalNumber value={value.scale} step={0.05} onChange={scale => onChange({scale})} />
      </Row>
      <Row label="New page before">
        <BooleanSelect
          value={value.pageBreakBefore}
          allowInherit
          onChange={pageBreakBefore => onChange({pageBreakBefore})} />
      </Row>
      <Row label="Keep with next">
        <BooleanSelect
          value={value.keepWithNext}
          allowInherit
          onChange={keepWithNext => onChange({keepWithNext})} />
      </Row>
      <Row label="Hidden">
        <BooleanSelect value={value.hidden} allowInherit onChange={hidden => onChange({hidden})} />
      </Row>
      <Row label="Hebrew CSS">
        <input
          value={value.css ?? ""}
          placeholder="e.g. letter-spacing: 0.05em"
          onChange={e => onChange({css: e.target.value || undefined})} />
      </Row>
    </>
  );
}

interface WordRange {
  start: number;
  end: number;
}

function stylesCover(styles: {start: number; end: number}[] | undefined, index: number): boolean {
  return (styles ?? []).some(x => x.start <= index && index < x.end);
}

function WordChips(props: {
  tokens: Token[];
  rtl: boolean;
  selection?: WordRange;
  onSelect: (range: WordRange | undefined) => void;
  splits: number[];
  breaks: number[];
  styled: {start: number; end: number}[] | undefined;
}) {
  const {tokens, selection} = props;
  return (
    <div className={`word-chips ${props.rtl ? "rtl" : ""}`}>
      {tokens.map((token, i) => {
        if (token.kind === "br") {
          // eslint-disable-next-line react/no-array-index-key
          return <span key={i} className="marker" title="Line break in the source">⏎</span>;
        }
        const selected = selection && i >= selection.start && i < selection.end;
        const classes = ["chip", selected ? "selected" : "", stylesCover(props.styled, i) ? "styled" : ""];
        return (
          // eslint-disable-next-line react/no-array-index-key
          <React.Fragment key={i}>
            {props.splits.includes(i) ? <span className="marker split" title="Split">¶</span> : null}
            {props.breaks.includes(i) ? <span className="marker" title="Line break">↵</span> : null}
            {/* eslint-disable-next-line max-len */}
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
            <span
              className={classes.join(" ")}
              onClick={event => {
                if (event.shiftKey && selection) {
                  props.onSelect({
                    start: Math.min(selection.start, i),
                    end: Math.max(selection.end, i + 1),
                  });
                } else {
                  props.onSelect({start: i, end: i + 1});
                }
              }}
              // Token HTML is entity-escaped text without tags (tags are carried as marks).
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{__html: token.html}} />
          </React.Fragment>
        );
      })}
    </div>
  );
}

function StyleButtons({onStyle, onClear, disabled}: {
  onStyle: (style: InlineStyle) => void;
  onClear: () => void;
  disabled: boolean;
}) {
  const [color, setColor] = useState("#7a1f1f");
  return (
    <div className="button-row">
      <button disabled={disabled} onClick={() => onStyle({bold: true})}><b>B</b></button>
      <button disabled={disabled} onClick={() => onStyle({italic: true})}><i>I</i></button>
      <button disabled={disabled} onClick={() => onStyle({scale: 1.25})} title="Larger">A+</button>
      <button disabled={disabled} onClick={() => onStyle({scale: 0.8})} title="Smaller">A−</button>
      <button disabled={disabled} onClick={() => onStyle({letterSpacing: 0.08})} title="Letter-spacing">a b</button>
      <button disabled={disabled} onClick={() => onStyle({smallCaps: true})} title="Small caps">Sc</button>
      <input type="color" value={color} onChange={e => setColor(e.target.value)} disabled={disabled} />
      <button disabled={disabled} onClick={() => onStyle({color})}>Color</button>
      <button disabled={disabled} onClick={onClear}>Clear</button>
    </div>
  );
}

function SegmentEditor({doc, update, selection, segment}: {
  doc: SiddurDocument;
  update: Update;
  selection: Selection;
  segment: SiddurSegmentData;
}) {
  const [scope, setScope] = useState<Scope>("segment");
  const [heRange, setHeRange] = useState<WordRange>();
  const [enRange, setEnRange] = useState<WordRange>();
  const [customCss, setCustomCss] = useState("");
  const {ref} = selection;
  const override = doc.segmentOverrides[ref] ?? {};

  useEffect(() => {
    setHeRange(undefined);
    setEnRange(undefined);
  }, [ref]);

  const heText = override.heOverride ?? segment.he;
  const enText = override.enOverride ?? segment.en;
  const heTokens = useMemo(() => tokenize(heText), [heText]);
  const enTokens = useMemo(() => tokenize(enText), [enText]);
  const resolved = resolveOptions([
    doc.defaults,
    doc.sectionOverrides[selection.sectionId],
    doc.paragraphOverrides[selection.paragraphKey],
    override,
  ]);
  const splits = segmentSplits(override, heTokens, enTokens, resolved.splitLines);
  const commentary = effectiveCommentary(doc, segment, ref, KOREN_SACKS);
  const ownCommentary = (doc.commentary[ref] ?? []).some(x => x.type === KOREN_SACKS);
  const sourceCommentary = Boolean(segment.commentary?.[KOREN_SACKS]?.length);

  const scopes: {id: Scope; label: string}[] = [
    {id: "piece", label: "Piece"},
    {id: "segment", label: "Segment"},
    {id: "paragraph", label: "Paragraph"},
    {id: "section", label: "Section"},
    {id: "document", label: "All"},
  ];

  return (
    <>
      <h3>Selected</h3>
      <div className="hint" style={{wordBreak: "break-word"}}>
        {ref}
        {(override.splitHe?.length ?? 0) > 0 ? ` · piece ${selection.pieceIndex + 1}/${override.splitHe!.length + 1}` : ""}
      </div>

      <h3>Layout</h3>
      <div className="scope-tabs">
        {scopes.map(x => (
          <button key={x.id} className={scope === x.id ? "active" : ""} onClick={() => setScope(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <LayoutOptionsEditor
        value={layoutAt(doc, selection, scope)}
        allowInherit={scope !== "document"}
        onChange={change => update(x => setLayoutAt(x, selection, scope, change))} />

      <h3>Hebrew words</h3>
      <div className="hint">Click a word (shift-click to extend), then split, break, or style.</div>
      <WordChips
        tokens={heTokens}
        rtl
        selection={heRange}
        onSelect={setHeRange}
        splits={splits.he}
        breaks={override.breaksHe ?? []}
        styled={override.stylesHe} />
      <div className="button-row">
        <button
          disabled={!heRange || heRange.start === 0}
          onClick={() => update(x => toggleSplit(x, ref, heRange!.start))}
          title="Split the segment into separate pieces before the selected word">
          ¶ Split here
        </button>
        <button
          disabled={!heRange || heRange.start === 0}
          onClick={() => update(x => toggleBreak(x, ref, "he", heRange!.start))}
          title="Force a line break before the selected word">
          ↵ Line break
        </button>
      </div>
      <StyleButtons
        disabled={!heRange}
        onStyle={style => update(x => addStyle(x, ref, "he", heRange!.start, heRange!.end, style))}
        onClear={() => update(x => clearStyles(x, ref, "he", heRange!.start, heRange!.end))} />
      <div className="button-row">
        <input
          value={customCss}
          placeholder="Custom CSS for selection"
          onChange={e => setCustomCss(e.target.value)}
          style={{flex: 1}} />
        <button
          disabled={!heRange || !customCss}
          onClick={() => update(x => addStyle(x, ref, "he", heRange!.start, heRange!.end, {css: customCss}))}>
          Apply
        </button>
      </div>

      <h3>English words</h3>
      <WordChips
        tokens={enTokens}
        rtl={false}
        selection={enRange}
        onSelect={setEnRange}
        splits={splits.en}
        breaks={override.breaksEn ?? []}
        styled={override.stylesEn} />
      <div className="button-row">
        {(override.splitHe ?? []).map((_, i) => (
          <button
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            disabled={!enRange}
            onClick={() => update(x => setEnglishSplit(x, ref, i, enRange!.start))}
            title={`Match Hebrew split ${i + 1} at the selected English word`}>
            ¶{i + 1} here
          </button>
        ))}
        <button
          disabled={!enRange || enRange.start === 0}
          onClick={() => update(x => toggleBreak(x, ref, "en", enRange!.start))}>
          ↵ Line break
        </button>
      </div>
      <StyleButtons
        disabled={!enRange}
        onStyle={style => update(x => addStyle(x, ref, "en", enRange!.start, enRange!.end, style))}
        onClear={() => update(x => clearStyles(x, ref, "en", enRange!.start, enRange!.end))} />

      <h3>Koren Sacks commentary</h3>
      <textarea
        value={commentary}
        placeholder="Commentary for this segment (HTML allowed: <b>, <i>)"
        onChange={e => update(x => setCommentary(x, ref, KOREN_SACKS, e.target.value))} />
      <div className="button-row">
        {sourceCommentary
          ? <span className="hint">{ownCommentary ? "Edited (Sefaria has text)" : "From Sefaria"}</span>
          : null}
        <button
          disabled={!ownCommentary}
          onClick={() => update(x => resetCommentary(x, ref, KOREN_SACKS))}>
          {sourceCommentary ? "Reset to Sefaria" : "Clear"}
        </button>
        <button
          disabled={!commentary}
          onClick={() => update(x => setCommentary(x, ref, KOREN_SACKS, ""))}>
          Suppress
        </button>
      </div>

      <h3>Text corrections</h3>
      <details>
        <summary className="hint">Edit the source text of this segment</summary>
        <textarea
          dir="rtl"
          value={override.heOverride ?? segment.he}
          onChange={e => update(x => setTextOverride(x, ref, "he", e.target.value === segment.he ? undefined : e.target.value))} />
        <textarea
          value={override.enOverride ?? segment.en}
          onChange={e => update(x => setTextOverride(x, ref, "en", e.target.value === segment.en ? undefined : e.target.value))} />
        <div className="hint">Word indices refer to the edited text; re-check splits after editing.</div>
      </details>
      <div className="button-row">
        <button onClick={() => update(x => resetSegment(x, ref))}>Reset this segment</button>
      </div>
    </>
  );
}

function SectionPicker({doc, update}: {doc: SiddurDocument; update: Update}) {
  const edition = SIDDUR_EDITIONS.find(x => x.id === doc.edition);
  if (!edition) return null;
  const order = new Map(edition.sections.map((x, i) => [x.id, i]));
  const toggle = (id: string, checked: boolean) => update(x => ({
    ...x,
    sections: (checked ? [...x.sections, id] : x.sections.filter(s => s !== id))
      .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)),
  }));
  let lastGroup = "";
  return (
    <div className="section-list">
      {edition.sections.map(section => {
        const header = section.group !== lastGroup
          ? <div className="group">{section.group} · {section.groupHebrew}</div>
          : null;
        lastGroup = section.group;
        return (
          <React.Fragment key={section.id}>
            {header}
            <div>
              <input
                type="checkbox"
                id={`section-${section.id}`}
                checked={doc.sections.includes(section.id)}
                onChange={e => toggle(section.id, e.target.checked)} />
              <label htmlFor={`section-${section.id}`}>
                {section.title} <span className="hint">{section.titleHebrew}</span>
              </label>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function SiddurPanel({doc, update, sections, selection, setSelection}: {
  doc: SiddurDocument;
  update: Update;
  sections?: Map<string, SiddurSectionData>;
  selection?: Selection;
  setSelection: (selection: Selection | undefined) => void;
}): React.ReactElement {
  const segment = selection
    ? sections?.get(selection.sectionId)?.segments.find(x => x.ref === selection.ref)
    : undefined;
  const setTypography = (key: keyof SiddurDocument["typography"], value: any) => (
    update(x => ({...x, typography: {...x.typography, [key]: value}})));

  return (
    <div className="print-panel no-print">
      {selection && segment
        ? (
          <>
            <div className="button-row">
              <button onClick={() => setSelection(undefined)}>← Document settings</button>
            </div>
            <SegmentEditor doc={doc} update={update} selection={selection} segment={segment} />
          </>
        )
        : (
          <>
            <div className="hint">Click any text on a page to edit its layout, split it, or style words.</div>
            <h3>Edition</h3>
            <Row label="Nusach">
              <select
                value={doc.edition}
                onChange={e => update(x => ({...x, edition: e.target.value, sections: []}))}>
                {SIDDUR_EDITIONS.map(x => (
                  <option key={x.id} value={x.id} disabled={!x.enabled}>
                    {x.title}{x.enabled ? "" : " (coming)"}
                  </option>
                ))}
              </select>
            </Row>
            <h3>Prayers</h3>
            <SectionPicker doc={doc} update={update} />
            <Row label="Layout">
              <select
                value={doc.spread}
                onChange={e => update(x => ({...x, spread: e.target.value as SiddurDocument["spread"]}))}>
                <option value="single">Single pages</option>
                <option value="facing">Facing pages (Hebrew | English)</option>
              </select>
            </Row>
            {doc.spread === "facing"
              ? (
                <Row label="Hebrew on the">
                  <select
                    value={doc.facingHebrewSide}
                    onChange={e => update(x => ({
                      ...x,
                      facingHebrewSide: e.target.value as SiddurDocument["facingHebrewSide"],
                    }))}>
                    <option value="left">Left page</option>
                    <option value="right">Right page</option>
                  </select>
                </Row>
              ) : null}
            <Row label="Each prayer on a new page">
              <input
                type="checkbox"
                checked={doc.sectionPageBreaks}
                onChange={e => update(x => ({...x, sectionPageBreaks: e.target.checked}))} />
            </Row>
            <Row label="Show Koren Sacks commentary">
              <input
                type="checkbox"
                checked={doc.showCommentary.includes(KOREN_SACKS)}
                onChange={e => update(x => ({
                  ...x,
                  showCommentary: e.target.checked
                    ? [...x.showCommentary, KOREN_SACKS]
                    : x.showCommentary.filter(c => c !== KOREN_SACKS),
                }))} />
            </Row>

            <h3>Default layout</h3>
            <LayoutOptionsEditor
              value={doc.defaults}
              allowInherit={false}
              onChange={change => update(x => ({...x, defaults: {...x.defaults, ...change}}))} />

            <h3>Page</h3>
            <PageSettingsEditor page={doc.page} onChange={page => update(x => ({...x, page}))} />

            <h3>Typography</h3>
            <Row label="Hebrew font">
              <select value={doc.typography.hebrewFont} onChange={e => setTypography("hebrewFont", e.target.value)}>
                {fontsForScript("hebrew").map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </Row>
            <Row label="English font">
              <select value={doc.typography.englishFont} onChange={e => setTypography("englishFont", e.target.value)}>
                {fontsForScript("latin").map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </Row>
            <Row label="Hebrew size (pt)">
              <NumberInput value={doc.typography.hebrewSizePt} step={0.5} onChange={v => setTypography("hebrewSizePt", v)} />
            </Row>
            <Row label="English size (pt)">
              <NumberInput value={doc.typography.englishSizePt} step={0.5} onChange={v => setTypography("englishSizePt", v)} />
            </Row>
            <Row label="Line height">
              <NumberInput value={doc.typography.lineHeight} step={0.05} onChange={v => setTypography("lineHeight", v)} />
            </Row>
            <Row label="Instruction color">
              <input
                type="color"
                value={doc.typography.instructionColor}
                onChange={e => setTypography("instructionColor", e.target.value)} />
            </Row>
            <Row label="Accent color">
              <input
                type="color"
                value={doc.typography.accentColor}
                onChange={e => setTypography("accentColor", e.target.value)} />
            </Row>
          </>
        )}
    </div>
  );
}
