import {JewishCalendar} from "kosher-zmanim";
import * as _ from "underscore";
import {
  ApiResponse,
  CommentaryMap,
  Section,
  ApiComment,
} from "./apiTypes";
import {Book, books, internalLinkableRef} from "./books";
import {ALL_COMMENTARIES, CommentaryType} from "./commentaries";
import {readUtf8} from "./files";
import {hadranSegments, isHadran} from "./hadran";
import {stripHebrewNonlettersOrVowels, intToHebrewNumeral, ALEPH, BET, TAV} from "./hebrew";
import {Logger, consoleLogger} from "./logger";
import {mergeRefs} from "./ref_merging";
import {refSorter} from "./js/google_drive/ref_sorter";
import {ListMultimap} from "./multimap";
import {getSugyaSpanningRef, shulchanArukhChapterTitle, segmentCount} from "./precomputed";
import {expandRef} from "./ref_expander";
import {splitOnBookName} from "./refs";
import {RequestMaker} from "./request_makers";
import {
  equalJaggedArrays,
  firstOrOnlyElement,
  sefariaTextTypeTransformation,
} from "./sefariaTextType";
import {
  BOLDIFY_REFS,
  DONT_MAKE_INTO_EXPLANATIONS,
  ENGLISH_TEXT_REPLACEMENTS,
  HARDCODED_TEXT,
  HEBREW_SECTION_NAMES,
  HEBREW_TEXT_REPLACEMENTS,
  KEEP_TROPE_REFS,
  REALLY_BIG_TEXT_REFS,
  SEGMENT_SEPERATOR_REF,
  SIDDUR_DEFAULT_MERGE_WITH_NEXT,
  SIDDUR_IGNORED_COMMENTARIES,
  SIDDUR_IGNORED_FOOTNOTES,
  SIDDUR_IGNORED_REFS,
  SIDDUR_IGNORED_SOURCE_REFS,
  SIDDUR_IGNORED_TARGET_REFS,
  SIDDUR_MERGE_PAIRS,
  SIDDUR_REFS_ASHKENAZ,
  SIDDUR_REFS_SEFARD,
  SMALLIFY_REFS,
  SYNTHETIC_REFS,
  UNSMALL_REFS,
  BIRKAT_HAMAZON_REFS,
  MergeWithNext,
  MergeRefsByDefault,
  RefPiece,
  getRef,
} from "./siddur";
import {CommentaryParenthesesTransformer} from "./source_formatting/commentary_parentheses";
import {CommentaryPrefixStripper} from "./source_formatting/commentary_prefixes";
import {boldDibureiHamatchil} from "./source_formatting/dibur_hamatchil";
import {FootnotesExtractor} from "./source_formatting/footnotes";
import {HebrewSmallToEmphasisTagTranslator} from "./source_formatting/hebrew_small_to_emphasis";
import {highlightRashiQuotations} from "./source_formatting/rashi_quoting";
import {HtmlNormalizer} from "./source_formatting/html_normalizer";
import {ImageNumberingFormatter} from "./source_formatting/image_numbering";
import {JastrowReformatter} from "./source_formatting/jastrow";
import {parseOtzarLaazeiRashi} from "./source_formatting/otzar_laazei_rashi";
import {SectionSymbolRemover} from "./source_formatting/section_symbol";
import {SefariaLinkSanitizer} from "./source_formatting/sefaria_link_sanitizer";
import {ShulchanArukhHeaderRemover} from "./source_formatting/shulchan_arukh_remove_header";
import {isPehSectionEnding, transformTanakhSpacing} from "./source_formatting/tanakh_spacing";
import {hasMatchingProperty} from "./util/objects";
import {checkNotUndefined} from "./js/undefined";
import {getWeekdayReading} from "./weekday_parshiot";
import {ASERET_YIMEI_TESHUVA_REFS} from "./js/aseret_yimei_teshuva";

const standardEnglishTransformations = sefariaTextTypeTransformation(
  english => (
    HtmlNormalizer.process(
      SectionSymbolRemover.process(
        SefariaLinkSanitizer.process(english)))
  ));

function stripRefSegmentNumber(ref: string): string {
  const index = ref.indexOf(":");
  return index === -1 ? ref : ref.substring(0, index);
}

function stripRefQuotationMarks(ref: string): string {
  const parts = ref.split(" ");
  const lastPart = parts.pop() ?? "";
  if (!lastPart.includes(":")) {
    return ref;
  }
  parts.push(lastPart.replace(/׳/g, "").replace(/״/g, ""));
  return parts.join(" ");
}

function stripPossiblePrefix(text: string, prefix: string): string {
  if (text.startsWith(prefix)) {
    return text.slice(prefix.length);
  }
  return text;
}

type SplitType = [string, string][];

/** A single comment on a text. */
class Comment {
  static create(
    link: sefaria.TextLink,
    sefariaComment: sefaria.TextResponse,
    englishName: string,
    logger: Logger,
  ): Comment {
    const {ref} = sefariaComment;
    let {he: hebrew, text: english} = sefariaComment;
    let {sourceRef, sourceHeRef} = link;
    if (equalJaggedArrays(hebrew, english)) {
      // Fix an issue where sometimes Sefaria returns the exact same text. For now, safe to
      // assume that the equivalent text is Hebrew.
      logger.log(`${ref} has identical hebrew and english`);
      english = "";
    }

    if (englishName === "Otzar Laazei Rashi") {
      [hebrew, english] = parseOtzarLaazeiRashi(hebrew as string);
    }

    hebrew = boldDibureiHamatchil(hebrew, englishName);
    hebrew = highlightRashiQuotations(hebrew);
    for (const processor of (
      [
        HebrewSmallToEmphasisTagTranslator,
        CommentaryPrefixStripper,
        CommentaryParenthesesTransformer,
        ImageNumberingFormatter,
        HtmlNormalizer])) {
      hebrew = processor.process(hebrew, englishName);
    }

    english = standardEnglishTransformations(english);
    english = JastrowReformatter.process(english, englishName);

    const _internalLinkableRef = internalLinkableRef(sourceRef);
    if (englishName === "Mesorat Hashas" && _internalLinkableRef) {
      sourceRef = stripRefSegmentNumber(sourceRef);
      sourceHeRef = stripRefSegmentNumber(sourceHeRef);
    } else {
      sourceHeRef = stripRefQuotationMarks(sourceHeRef);
    }

    const talmudPageLink = _internalLinkableRef?.toUrlPathname();

    if (englishName === "Shulchan Arukh") {
      const subtitle = shulchanArukhChapterTitle(ref);
      if (subtitle) {
        sourceHeRef = `${sourceHeRef} - ${subtitle}`;
        if (ref.endsWith(":1")) {
          hebrew = ShulchanArukhHeaderRemover.process(hebrew, englishName);
        }
      }
    } else if (englishName === "Mishneh Torah") {
      sourceRef = stripPossiblePrefix(sourceRef, "Mishneh Torah, ");
      sourceHeRef = stripPossiblePrefix(sourceHeRef, "משנה תורה, ");
    }

    return new Comment(
      englishName,
      hebrew,
      english,
      ref,
      sourceRef,
      sourceHeRef,
      talmudPageLink,
      link.originalRefsBeforeRewriting,
      link.expandedRefsAfterRewriting,
    );
  }

  constructor(
    readonly englishName: string,
    readonly hebrew: sefaria.TextType,
    readonly english: sefaria.TextType,
    readonly ref: string,
    readonly sourceRef: string,
    private sourceHeRef: string,
    private talmudPageLink?: string,
    private readonly originalRefsBeforeRewriting?: string[],
    private readonly expandedRefsAfterRewriting?: string[],
  ) {}

  toJson(): ApiComment {
    const result: ApiComment = {
      he: this.hebrew,
      en: this.english,
      ref: this.ref,
      sourceRef: this.sourceRef,
      sourceHeRef: this.sourceHeRef,
    };
    if (this.talmudPageLink) {
      result.link = this.talmudPageLink;
    }
    if (this.originalRefsBeforeRewriting) {
      result.originalRefsBeforeRewriting = this.originalRefsBeforeRewriting;
    }
    if (this.expandedRefsAfterRewriting) {
      result.expandedRefsAfterRewriting = this.expandedRefsAfterRewriting;
    }
    return result;
  }

  static fakeTextLink = {
    sourceRef: "fake",
    sourceHeRef: "fake",
    ref: "fake",
    anchorRef: "fake",
    anchorRefExpanded: ["fake"],
    versionTitle: "fake",
  };
}

/** Maintains the state of all comments on a particular segment or (nested) commentary. */
class InternalCommentary {
  private refs = new Set<string>();
  comments: Comment[] = [];
  nestedCommentaries: Record<string, InternalCommentary> = {};

  addComment(comment: Comment) {
    if (this.refs.has(comment.ref)) {
      return;
    }
    this.refs.add(comment.ref);
    this.comments.push(comment);
  }

  nestedCommentary(parentRef: string) {
    if (!(parentRef in this.nestedCommentaries)) {
      this.nestedCommentaries[parentRef] = new InternalCommentary();
    }
    return this.nestedCommentaries[parentRef];
  }

  removeComment(comment: Comment) {
    const {ref} = comment;
    this.refs.delete(ref);
    this.comments = this.comments.filter(x => x.ref !== ref);
  }

  removeCommentWithRef(ref: string) {
    for (const comment of this.comments) {
      if (ref === comment.ref) {
        this.removeComment(comment);
        break;
      }
    }
  }

  toJson(): CommentaryMap {
    const result: CommentaryMap = {};
    for (const comment of this.comments) {
      if (!(comment.englishName in result)) {
        result[comment.englishName] = {comments: []};
      }
      const apiComment = comment.toJson();
      for (const [ref, nestedCommentary] of Object.entries(this.nestedCommentaries)) {
        if (comment.ref !== ref) continue;
        const nestedCommentaryValue = nestedCommentary.toJson();
        if (Object.keys(nestedCommentaryValue).length === 0) continue;
        if (apiComment.commentary === undefined) {
          apiComment.commentary = {};
        }
        Object.assign(apiComment.commentary, nestedCommentaryValue);
      }

      result[comment.englishName].comments.push(apiComment);
    }

    /*
    for (const [englishName, nestedCommentary] of Object.entries(this.nestedCommentaries)) {
      const nestedCommentaryValue = nestedCommentary.toJson();
      if (Object.keys(nestedCommentaryValue).length > 0) {
        if (!result[englishName]) {
          // This case can arise when a duplicated nested commentary is removed. The parent still
          // has a reference to the nested commentary, but there is no parent comment to attach it
          // to.
          continue;
        }
        result[englishName].commentary = nestedCommentaryValue;
      }
    }
    */

    return result;
  }

  addAll(other: InternalCommentary) {
    for (const ref of Array.from(other.refs)) {
      this.refs.add(ref);
    }
    this.comments.push(...other.comments);
    for (const [key, nested] of Object.entries(other.nestedCommentaries)) {
      if (!(key in this.nestedCommentaries)) {
        this.nestedCommentaries[key] = new InternalCommentary();
      }
      this.nestedCommentaries[key].addAll(nested);
    }
  }
}

interface InternalSegmentConstructorParams {
  hebrew: sefaria.TextType,
  english: sefaria.TextType,
  ref: string,
}

export class InternalSegment {
  hebrew: sefaria.TextType;
  english: sefaria.TextType;
  readonly ref: string;
  commentary = new InternalCommentary();
  hadran?: true;
  // eslint-disable-next-line camelcase
  steinsaltz_start_of_sugya?: true;
  lastSegmentOfSection?: true;
  defaultMergeWithNext?: true;

  constructor({hebrew, english, ref}: InternalSegmentConstructorParams) {
    this.hebrew = hebrew;
    this.english = english;
    this.ref = ref;
  }

  static merge(segments: InternalSegment[]): InternalSegment {
    const hebrews = [];
    const englishes = [];
    const refs = [];
    for (const segment of segments) {
      if (typeof segment.hebrew !== "string") {
        throw new TypeError("segment.hebrew is not a string! " + segment.hebrew);
      } else if (typeof segment.english !== "string") {
        throw new TypeError("segment.english is not a string! " + segment.english);
      }
      hebrews.push(segment.hebrew);
      englishes.push(segment.english);
      refs.push(segment.ref);
    }
    const mergedRefs = Array.from(mergeRefs(refs).keys());
    if (mergedRefs.length !== 1) {
      throw new Error(mergedRefs.join(" :: "));
    }
    const newSegment = new InternalSegment({
      hebrew: hebrews.join(" "),
      english: englishes.join(" "),
      ref: mergedRefs[0],
    });
    for (const segment of segments) {
      newSegment.commentary.addAll(segment.commentary);
      if (segment.hadran) {
        newSegment.hadran = true;
      }
      if (segment.steinsaltz_start_of_sugya) {
        newSegment.steinsaltz_start_of_sugya = true;
      }
      if (segment.defaultMergeWithNext) {
        newSegment.defaultMergeWithNext = true;
      }
    }
    return newSegment;
  }

  toJson(): Section {
    const json: Section = {
      he: this.hebrew,
      en: this.english,
      ref: this.ref,
      commentary: this.commentary.toJson(),
    };
    if (this.hadran) {
      json.hadran = this.hadran;
    }
    if (this.steinsaltz_start_of_sugya) {
      json.steinsaltz_start_of_sugya = this.steinsaltz_start_of_sugya;
    }
    if (this.lastSegmentOfSection) {
      json.lastSegmentOfSection = true;
    }
    if (this.defaultMergeWithNext) {
      json.defaultMergeWithNext = this.defaultMergeWithNext;
    }
    return json;
  }
}

class LinkGraph {
  graph: Record<string, Set<string>> = {};
  links: Record<string, Record<string, sefaria.TextLink>> = {}
  textResponses: Record<string, sefaria.TextResponse> = {};
  // TODO(typescript): don't cache the result if the link graph is incomlete
  complete = true;

  hasLink(sourceRef: string, targetRef: string): boolean {
    return this.getGraph(sourceRef).has(targetRef);
  }

  getGraph(sourceRef: string): Set<string> {
    if (!(sourceRef in this.graph)) {
      this.graph[sourceRef] = new Set<string>();
    }
    return this.graph[sourceRef];
  }

  addLink(sourceRef: string, link: sefaria.TextLink): void {
    this.getGraph(sourceRef).add(link.ref);
    if (this.links[sourceRef] === undefined) {
      this.links[sourceRef] = {};
    }
    this.links[sourceRef][link.ref] = link;
  }
}

function textRequestEndpoint(ref: string): string {
  return `/texts/${ref}?wrapLinks=0&commentary=0&context=0`;
}

export class ApiException extends Error {
  static SEFARIA_HTTP_ERROR = 1;
  static UNEQAUL_HEBREW_ENGLISH_LENGTH = 2;

  constructor(
    message: string,
    readonly httpStatus: number,
    readonly internalCode: number,
  ) {
    super(message);
  }
}

function isSefariaError(response: any): response is sefaria.ErrorResponse {
  return "error" in response;
}

const LOTS_OF_NON_BREAKING_SPACES = new RegExp(String.fromCharCode(160) + "{4,}", 'g');

export abstract class AbstractApiRequestHandler {
  private applicableCommentaries: CommentaryType[];

  constructor(
    protected readonly bookName: string,
    protected readonly page: string,
    protected readonly requestMaker: RequestMaker,
    protected readonly logger: Logger,
  ) {
    this.applicableCommentaries = this.getApplicableCommentaries();
  }

  protected abstract makeId(): string;

  protected makeSubRef(mainRef: string, index: number): string {
    if (mainRef.includes("-")) {
      const lastColon = mainRef.lastIndexOf(":");
      const range = mainRef.substring(lastColon + 1);
      const start = parseInt(range.split("-")[0]);
      return `${mainRef.substring(0, lastColon)}:${start + index}`;
    } else {
      return `${mainRef}:${index + 1}`;
    }
  }

  protected makeTitle(): string {
    return `${books.byCanonicalName[this.bookName].canonicalName} ${this.page}`;
  }

  protected abstract makeTitleHebrew(): string;

  private replaceLotsOfNonBreakingSpacesWithNewlines(text: string): string {
    return text.replace(LOTS_OF_NON_BREAKING_SPACES, "<br>");
  }

  // eslint-disable-next-line  @typescript-eslint/no-unused-vars
  protected translateHebrewText(text: sefaria.TextType, ref: string): sefaria.TextType {
    return sefariaTextTypeTransformation(this.replaceLotsOfNonBreakingSpacesWithNewlines)(text);
  }

  // eslint-disable-next-line  @typescript-eslint/no-unused-vars
  protected translateEnglishText(text: sefaria.TextType, ref: string): sefaria.TextType {
    return standardEnglishTransformations(text);
  }

  protected maybeSplit(ref: string, hebrew: string, english: string): SplitType {
    return [[hebrew, english]];
  }

  /** Called before postProcessAllSegments(). */
  protected postProcessSegment(segment: InternalSegment): InternalSegment {
    return segment;
  }

  protected postProcessAllSegments(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    segments: InternalSegment[], ...extraValues: any[]
  ): InternalSegment[] {
    return segments;
  }

  protected injectSegmentSeperators(segments: InternalSegment[]): InternalSegment[] {
    const newSegments = [];
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment.ref === SEGMENT_SEPERATOR_REF) {
        segments[i + 1].steinsaltz_start_of_sugya = true;
      } else {
        newSegments.push(segment);
      }
    }
    return newSegments;
  }

  protected extraSegments(): Section[] {
    return [];
  }

  protected linkDepth(): number {
    return 2;
  }

  handleRequest(): Promise<ApiResponse> {
    const book = books.byCanonicalName[this.bookName];
    const ref = `${book.bookNameForRef()} ${book.rewriteSectionRef(this.page)}`;
    const underlyingRefs = this.expandRef(ref);

    const textRequest = this.makeTextRequest(ref, underlyingRefs);
    const linksTraversalTimer = this.logger.newTimer();
    const linkGraphRequest = this.linksTraversal(
      new LinkGraph(), ListMultimap.identity(underlyingRefs), this.linkDepth(), true)
      .finally(() => linksTraversalTimer.finish("links traversal"));
    return Promise.all([
      textRequest,
      linkGraphRequest.then(linkGraph => {
        const textRequestRefs = new Set<string>();
        const addTextRequestRef = (requestRef: string) => {
          if (!(requestRef in linkGraph.textResponses)
            && !underlyingRefs.some(underlyingRef => requestRef.startsWith(underlyingRef))) {
            textRequestRefs.add(requestRef);
          }
        };
        for (const [key, graph] of Object.entries(linkGraph.graph)) {
          addTextRequestRef(key);
          graph.forEach(addTextRequestRef);
        }

        return this.fetchData(Array.from(textRequestRefs), ref)
          .then(fetched => {
            for (const [fetchedRef, textResponse] of Object.entries(fetched)) {
              linkGraph.textResponses[fetchedRef] = textResponse;
            }
          })
          .then(() => linkGraph);
      }),
      ...this.extraPromises(),
    ]).then(args => this.transformData(...args));
  }

  protected extraPromises(): Promise<any>[] {
    return [];
  }

  protected expandRef(ref: string): string[] {
    return [ref];
  }

  private makeTextRequest(ref: string, underlyingRefs: string[]): Promise<sefaria.TextResponse> {
    if (underlyingRefs.length === 1 && ref === underlyingRefs[0]) {
      return this.requestMaker.makeRequest<sefaria.TextResponse>(textRequestEndpoint(ref));
    }
    return this.fetchData(underlyingRefs, ref + "_bulk_root")
      .then(fetchedData => {
        const response: sefaria.TextResponse = {
          he: [],
          text: [],
          ref,
          refsPerSubText: [],
        };
        for (const underlyingRef of underlyingRefs) {
          const underlyingRefData = fetchedData[underlyingRef];
          let {he, text} = underlyingRefData;
          const addSegment = (
            hebrew: sefaria.TextType,
            english: sefaria.TextType,
            segmentRef: string,
          ) => {
            (response.he as string[]).push(hebrew as string);
            (response.text as string[]).push(english as string);
            response.refsPerSubText!.push(segmentRef);
          };
          if (typeof he === "string") {
            addSegment(he, text, underlyingRef);
          } else {
            he = he.flat();
            text = (text as any).flat();
            const addSegmentRange = (
              prefixRef: string, segmentIndices: number[], suffixIndices: number[]) => {
              for (let i = 0; i < segmentIndices.length; i++) {
                addSegment(
                  he[segmentIndices[i]],
                  text[segmentIndices[i]],
                  // The -1 here is a hack, since makeSubRef typically expects zero-indexed offsets.
                  this.makeSubRef(prefixRef, suffixIndices[i] - 1));
              }
            };

            if (Number.isNaN(parseInt(underlyingRef.slice(-1))) || !underlyingRef.includes("-")) {
              addSegmentRange(underlyingRef, _.range(he.length), _.range(1, he.length + 1));
              continue;
            }

            const [baseRef, refRange] = splitOnBookName(underlyingRef);
            const [start, end] = refRange.split("-");

            const chapterAndVerse = (combined: string): [string, number] => {
              const [chapter, verse] = combined.split(":");
              return [chapter, parseInt(verse)];
            };

            if (start.includes(":") && end.includes(":")) {
              const [startChapter, startVerse] = chapterAndVerse(start);
              const [endChapter, endVerse] = chapterAndVerse(end);
              addSegmentRange(
                `${baseRef} ${startChapter}`,
                _.range(he.length - endVerse),
                _.range(startVerse, startVerse + he.length - endVerse));
              addSegmentRange(
                `${baseRef} ${endChapter}`,
                _.range(he.length - endVerse, he.length),
                _.range(endVerse));
              continue;
            }

            if (start.includes(":")) {
              const [startChapter, startVerse] = chapterAndVerse(start);
              addSegmentRange(
                `${baseRef} ${startChapter}`,
                _.range(he.length),
                _.range(startVerse, startVerse + he.length));
            } else {
              addSegmentRange(
                baseRef,
                _.range(he.length),
                _.range(parseInt(start), parseInt(start) + he.length));
            }
          }
        }
        return response;
      });
  }

  private linksRequestUrl(ref: string) {
    return `/links/${ref}?with_text=0`;
  }

  private linksTraversal(
    linkGraph: LinkGraph,
    refsInRound: ListMultimap<string, string>,
    remainingDepth: number,
    isRoot: boolean,
  ): Promise<LinkGraph> {
    if (remainingDepth === 0) {
      return Promise.resolve(linkGraph);
    }

    const allLinksRequests = Promise.allSettled(
      Array.from(refsInRound.keys()).map(ref => {
        if (SYNTHETIC_REFS.has(ref)) {
          return Promise.resolve<sefaria.TextLink[]>([]);
        }
        const url = this.linksRequestUrl(ref);
        return this.requestMaker.makeRequest<sefaria.TextLink[] | sefaria.ErrorResponse>(url);
      }));

    return allLinksRequests.then(allLinksResponses => {
      const refsInRoundKeys = Array.from(refsInRound.keys());
      const nextRefs = [];
      for (let i = 0; i < allLinksResponses.length; i++) {
        const linksResponse = allLinksResponses[i];
        if (linksResponse.status === "rejected" || isSefariaError(linksResponse.value)) {
          this.logger.error("Links request error", linksResponse);
          linkGraph.complete = false;
          continue;
        }

        const ref = refsInRoundKeys[i];
        const mergedRefs = refsInRound.get(ref);
        for (const link of linksResponse.value) {
          const commentaryType = this.matchingCommentaryType(link);
          if (!commentaryType) continue;

          this.maybeRewriteLinkRef(commentaryType, link);

          const targetRef = link.ref;
          if (this.ignoreLink(mergedRefs, targetRef)) {
            continue;
          }
          if (targetRef in linkGraph.graph) {
            continue;
          }
          let sourceRefIndex = Math.min(
            ...mergedRefs.map(x => link.anchorRefExpanded.indexOf(x)).filter(x => x !== -1));
          if (sourceRefIndex === Infinity) {
            sourceRefIndex = 0;
          }
          if (targetRef.startsWith("Introductions to the Babylonian Talmud")
            && targetRef.includes("Summary of Perek")) {
            sourceRefIndex = link.anchorRefExpanded.length - 1;
          }
          const sourceRef = link.anchorRefExpanded[sourceRefIndex];
          if (linkGraph.hasLink(sourceRef, targetRef)
            || (!isRoot && commentaryType.ignoreIfNotTypeLevel)) {
            continue;
          }
          linkGraph.addLink(sourceRef, link);

          if (remainingDepth !== 0 && this.shouldTraverseNestedRef(commentaryType, link)) {
            nextRefs.push(targetRef);
          }
        }
      }
      return this.linksTraversal(linkGraph, mergeRefs(nextRefs), remainingDepth - 1, false);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected ignoreLink(mergedSourceRefs: string[], targetRef: string): boolean {
    return false;
  }

  protected maybeRewriteLinkRef(commentaryType: CommentaryType, link: sefaria.TextLink): void {
    if (!link.ref.includes(":")
      && books.byCanonicalName[link.collectiveTitle?.en ?? ""]?.isBibleBook()) {
      link.expandedRefsAfterRewriting = (
        _.range(1, segmentCount(link.ref)!).map(x => `${link.ref}:${x}`));
    }
    if (this.isMesoratHashasTalmudRef(commentaryType, link)) {
      const newRef = getSugyaSpanningRef(link.collectiveTitle?.en ?? "", link.ref);
      if (!newRef) return;
      link.originalRefsBeforeRewriting = expandRef(link.ref);
      link.ref = newRef;
      link.expandedRefsAfterRewriting = expandRef(newRef);
    }
  }

  private isMesoratHashasTalmudRef(
    commentaryType: CommentaryType, link: sefaria.TextLink,
  ): boolean {
    return commentaryType.englishName === "Mesorat Hashas" && link.category === "Talmud";
  }

  private shouldTraverseNestedRef(commentaryType: CommentaryType, link: sefaria.TextLink): boolean {
    return (commentaryType.allowNestedTraversals
      || this.isMesoratHashasTalmudRef(commentaryType, link));
  }

  private fetchData(
    refs: string[],
    requestId: string,
  ): Promise<Record<string, sefaria.TextResponse>> {
    if (refs.length === 0) {
      return Promise.resolve({});
    }

    const timer = this.logger.newTimer();
    const fetched: Record<string, sefaria.TextResponse> = {};
    const nestedPromises: Promise<unknown>[] = [];

    // 40 seems to be a sweet spot for speed. Perhaps it's because it limits the number of requests
    // without making any of those requests heavyweight.
    const shardSize = 40;

    // Sorting helps maintain expected outputs for tests, and also for debugging queries that may go
    // awry. There isn't much need to use mergeRefs(), and in fact it may cause problems with the
    // maintaining a stable shard size.
    refs = Array.from(refs);
    refs.sort(refSorter);
    for (const syntheticRef of Array.from(SYNTHETIC_REFS)) {
      if (refs.includes(syntheticRef)) {
        fetched[syntheticRef] = {ref: syntheticRef, he: "", text: ""};
        const [first, last] = [
          refs.indexOf(syntheticRef), refs.lastIndexOf(syntheticRef)];
        refs.splice(first, last - first + 1);
      }
    }

    for (let i = 0; i < refs.length; i += shardSize) {
      const delimitedRefs = refs.slice(i, i + shardSize).join("|");
      // The tp parameter is helpful for debugging and maintaining stability of recorded test data
      const url = `/bulktext/${delimitedRefs}?useTextFamily=1&tp=${requestId}@${i}`;
      nestedPromises.push(
        this.requestMaker.makeRequest<sefaria.BulkTextResponse>(url).then(allTexts => {
          for (const ref of Object.keys(allTexts)) {
            const response = allTexts[ref];
            fetched[ref] = {
              he: response.he,
              text: response.en,
              ref,
            };
          }
        }));
    }

    return Promise.allSettled(nestedPromises)
      .then(() => fetched)
      .finally(() => timer.finish("fetching secondary texts"));
  }

  private preformatSegments(hebrew: string[], english: string[]): [string[], string[]] {
    if (typeof hebrew === "string") {
      hebrew = [hebrew];
    }
    if (typeof english === "string") {
      english = [english];
    }
    if (Array.isArray(hebrew.concat(english)[0])) {
      const newHebrew: string[][] = [];
      const newEnglish: string[][] = [];
      for (let i = 0; i < hebrew.length; i++) {
        // @ts-ignore
        const [currentHebrew, currentEnglish] = this.preformatSegments(hebrew[i], english[i]);
        // Flattening is relevant for refs which are rewritten (like Yerushalmi pages) that span
        // multiple sections (i.e. multiple halachot/chapters).
        newHebrew.push(currentHebrew);
        newEnglish.push(currentEnglish);
      }
      return [newHebrew.flat(), newEnglish.flat()];
    }

    // https://github.com/Sefaria/Sefaria-Project/issues/543
    if (hebrew.length - 1 === english.length && isHadran(hebrew.slice(-1))) {
      english.push("");
    }

    if (hebrew.length !== english.length) {
      const extra = hebrew.slice(english.length).concat(english.slice(hebrew.length));
      this.logger.error("Unmatched text/translation: ", extra);
      throw new ApiException(
        `Hebrew length (${hebrew.length} != English length (${english.length})`,
        500,
        ApiException.UNEQAUL_HEBREW_ENGLISH_LENGTH);
    }

    return [hebrew, english];
  }

  private transformData(
    textResponse: sefaria.TextResponse,
    linkGraph: LinkGraph,
    ...extraValues: any[]
  ): ApiResponse {
    const timer = this.logger.newTimer();
    const mainRef = textResponse.ref;

    // TODO: There is dangling English text here. It's been reported to Sefaria but there's a war
    // right now..., so let's keep this fix here for now.
    if (this.bookName === "Numbers" && this.page === "25" && textResponse.text.length === 19) {
      (textResponse.text as string[]).pop();
    }

    const [hebrew, english] = this.preformatSegments(
      textResponse.he as string[],
      textResponse.text as string[]);

    let segments: InternalSegment[] = [];
    for (let i = 0; i < hebrew.length; i++) {
      const ref = (() => {
        if (textResponse.refsPerSubText) {
          return textResponse.refsPerSubText[i];
        } else if (textResponse.isSpanning) {
          return this.getSpanningRef(textResponse, i);
        }
        return this.makeSubRef(mainRef, i);
      })();
      for (const [currentHebrew, currentEnglish] of this.maybeSplit(ref, hebrew[i], english[i])) {
        const footnotesResult = FootnotesExtractor.extract(
          {he: currentHebrew, text: currentEnglish, ref});
        const segment = new InternalSegment({
          ref,
          hebrew: this.translateHebrewText(footnotesResult.comment.he, ref),
          english: this.translateEnglishText(footnotesResult.comment.text, ref),
        });
        this.addComments(ref, ref, segment.commentary, linkGraph, {count: 0});
        for (const footnote of footnotesResult.footnotes) {
          segment.commentary.addComment(
            Comment.create(Comment.fakeTextLink, footnote, "Footnotes", this.logger));
        }
        segments.push(segment);
      }
    }

    segments = this.injectSegmentSeperators(segments);
    segments = segments.map(x => this.postProcessSegment(x));
    segments = this.postProcessAllSegments(segments, ...extraValues);

    if (segments.length === 0) {
      this.logger.log(`No segments for ${mainRef}`);
    }

    timer.finish("transformData");

    return {
      id: checkNotUndefined(this.makeId(), "makeId"),
      title: checkNotUndefined(this.makeTitle(), "title"),
      titleHebrew: checkNotUndefined(this.makeTitleHebrew(), "titleHebrew"),
      sections: segments.map(x => x.toJson()).concat(this.extraSegments()),
    };
  }

  private addComments(
    rootRef: string,
    ref: string,
    commentary: InternalCommentary,
    linkGraph: LinkGraph,
    countObject: {count: number},
    cycleChecker: Set<string> = new Set(),
  ) {
    for (const linkRef of Array.from(linkGraph.graph[ref] ?? [])) {
      // This is heuristic to attempt to short-circuit comment traversals that never seem to end.
      // Unfortunately we don't want a simple "visited" set since we do want to revisit nodes,
      // but perhaps something that checks to not revisit them unless they reoccur at lower depths
      // would be useful.
      countObject.count++;
      if (countObject.count > 2000) {
        this.logger.log(`Halting comment traversal for ${rootRef} at ${countObject.count}`);
        return;
      }

      if (cycleChecker.has(linkRef)) continue;
      const linkResponse = linkGraph.textResponses[linkRef];
      if (!linkResponse || isSefariaError(linkResponse)) continue; // Don't process failed requests
      if (!linkResponse.he && !linkResponse.text) continue;
      if (linkResponse.he.length === 0 && linkResponse.text.length === 0) continue;

      const link = linkGraph.links[ref][linkRef];
      const commentaryType = this.matchingCommentaryType(link)!;

      if (this.isCommunityTranslation(link)) {
        const translationRef = "Translation on " + linkResponse.ref;
        linkGraph.textResponses[translationRef] = {
          he: "", text: linkResponse.text, ref: translationRef};
        linkResponse.text = "";
        linkGraph.addLink(linkRef, {
          ...Comment.fakeTextLink,
          collectiveTitle: {en: "Community Translation", he: ""},
          ref: translationRef,
        });
      }

      const {comment, footnotes} = FootnotesExtractor.extract(linkResponse);
      commentary.addComment(Comment.create(link, comment, commentaryType.englishName, this.logger));

      for (const footnote of footnotes) {
        commentary.nestedCommentary(linkRef).addComment(
          Comment.create(link, footnote, "Footnotes", this.logger));
      }

      cycleChecker.add(ref);
      this.addComments(
        rootRef,
        linkRef,
        commentary.nestedCommentary(linkRef),
        linkGraph,
        countObject,
        cycleChecker);
      cycleChecker.delete(ref);
    }
  }

  private isCommunityTranslation(link: sefaria.TextLink): boolean {
    const {sourceRef} = link;
    return sourceRef.startsWith("Tosafot") || sourceRef.startsWith("Rashi");
    return link.versionTitle === "Sefaria Community Translation"
      || link.versionTitle === "Tosafot, Translated by Jan Buckler";
  }

  private getApplicableCommentaries(): CommentaryType[] {
    const applicableCommentaryNames = new Set(this.applicableCommentaryNames());
    if (applicableCommentaryNames.size === 0) {
      return ALL_COMMENTARIES;
    }
    for (const defaultName of ["Translation", "Community Translation", "Footnotes"]) {
      applicableCommentaryNames.add(defaultName);
    }
    return ALL_COMMENTARIES.filter(x => applicableCommentaryNames.has(x.englishName));
  }

  protected applicableCommentaryNames(): string[] {
    return [];
  }

  private matchingCommentaryType(link: sefaria.TextLink): CommentaryType | undefined {
    if (!link.collectiveTitle) {
      this.logger.error("No comment title for", link);
      return undefined;
    }
    const name = link.collectiveTitle.en;
    for (const kind of this.applicableCommentaries) {
      if (name === kind.englishName
        || hasMatchingProperty(link, kind, "category")
        || hasMatchingProperty(link, kind, "type")
        || (kind.englishNamePattern && kind.englishNamePattern.test(name))
        || (kind.refPattern && kind.refPattern.test(link.ref))) {
        return kind;
      }
    }
    return undefined;
  }

  private getSpanningRef(textResponse: sefaria.TextResponse, i: number): string {
    let count = 0;
    let spanningRefIndex = 0;
    for (let innerList of textResponse.he as any as string[][]) {
      // Sometimes the shape of the texts are [N, 1, M]. It's possible that they could be even more
      // complex, but it's not very clear how to manage that. So for the time being, just flatten
      // the singleton dimension so that this is effectively of shape [N, M] so that the data is
      // predictable and maps well to spanningRefs.
      innerList = innerList.flat();
      for (let currentCount = 0; currentCount < innerList.length; (currentCount++, count++)) {
        if (count === i) {
          const spanningRef = textResponse.spanningRefs![spanningRefIndex];
          if (spanningRef === undefined) {
            this.logger.error(textResponse, i, count, spanningRefIndex);
          }
          return this.makeSubRef(spanningRef, currentCount);
        }
      }
      spanningRefIndex++;
    }
    throw new Error(`Can't find index ${i} in ${textResponse.spanningRefs}`);
  }
}

enum RemovalStrategy {
  REMOVE_TOP_LEVEL,
  REMOVE_NESTED,
}

const STEINSALTZ_SUGYA_START = new RegExp(`^<big>[${ALEPH}-${TAV}].*`);
const IGNORE_STEINSALTZ = "<ignore steinsaltz>";

class TalmudApiRequestHandler extends AbstractApiRequestHandler {
  protected makeId(): string {
    return this.page;
  }

  protected makeTitleHebrew(): string {
    const {hebrewName} = books.byCanonicalName[this.bookName];
    const dafNumber = intToHebrewNumeral(parseInt(this.page));
    const suffix = this.page.endsWith("a") ? ALEPH : BET;
    return `${hebrewName} ${dafNumber},${suffix}`;
  }

  protected extraPromises(): Promise<any>[] {
    return [
      this.requestMaker.makeSteinsaltzRequest(this.bookName, this.page.slice(0, -1))
        .catch(() => IGNORE_STEINSALTZ),
    ];
  }

  protected postProcessSegment(segment: InternalSegment): InternalSegment {
    this.resolveDuplicatedNestedCommentaries(segment.commentary);

    for (const comment of segment.commentary.comments) {
      if (comment.englishName === "Steinsaltz"
        && STEINSALTZ_SUGYA_START.test(firstOrOnlyElement(comment.hebrew))) {
        segment.steinsaltz_start_of_sugya = true;
      }
    }

    if (typeof segment.hebrew === "string" && isHadran(segment.hebrew)) {
      segment.hebrew = segment.hebrew.replace(/<br>/g, "");
      segment.english = "";
      const oldCommentary = segment.commentary;
      segment.commentary = new InternalCommentary();
      for (const comment of oldCommentary.comments) {
        if (comment.ref.includes("Summary of Perek")) {
          segment.commentary.addComment(comment);
        }
      }
      segment.hadran = true;
    }

    return segment;
  }

  private resolveDuplicatedNestedCommentaries(commentary: InternalCommentary) {
    const topLevelCommentsByRef = Object.fromEntries(commentary.comments.map(x => [x.ref, x]));
    for (const nestedCommentary of Object.values(commentary.nestedCommentaries)) {
      // It's important that this happens first, so that a comment is repeated at depths 0, 1, and 2
      // is only retained at 0
      this.resolveDuplicatedNestedCommentaries(nestedCommentary);

      for (const nestedComment of nestedCommentary.comments) {
        const topLevelComment = topLevelCommentsByRef[nestedComment.ref];
        if (!topLevelComment) continue;
        const removalStrategy = this.removalStrategy(topLevelComment, nestedComment);
        if (removalStrategy === RemovalStrategy.REMOVE_TOP_LEVEL) {
          commentary.removeComment(topLevelComment);
        } else if (removalStrategy === RemovalStrategy.REMOVE_NESTED) {
          nestedCommentary.removeComment(nestedComment);
        }
      }
    }
  }

  static REMOVE_TOP_LEVEL_KINDS = new Set([
    "Gilyon HaShas",
    "Maharsha",
    "Maharshal",
    "Meir Lublin",
    "Otzar Laazei Rashi",
  ]);

  private removalStrategy(
    topLevelComment: Comment,
    nestedComment: Comment,
  ): RemovalStrategy | undefined {
    if (TalmudApiRequestHandler.REMOVE_TOP_LEVEL_KINDS.has(nestedComment.englishName)) {
      return RemovalStrategy.REMOVE_TOP_LEVEL;
    }
    return RemovalStrategy.REMOVE_NESTED;
  }

  protected postProcessAllSegments(
    segments: InternalSegment[],
    steinsaltzResult: any,
  ): InternalSegment[] {
    if (this.bookName === "Nazir" && this.page === "33b") {
      return [new InternalSegment({
        hebrew: "אין גמרא לנזיר ל״ג ע״א, רק תוספות (שהם קשורים לדפים אחרים)",
        english: "Nazir 33b has no Gemara, just Tosafot (which are linked to other pages).",
        ref: "synthetic",
      })];
    }
    if (steinsaltzResult !== IGNORE_STEINSALTZ) {
      try {
        this.addSteinsaltzData(steinsaltzResult, this.page, segments);
      } catch (e) {
        this.logger.error(e);
      }
    }

    return segments;
  }

  private addSteinsaltzData(steinsaltzResult: any, amud: string, segments: InternalSegment[]) {
    const steinsaltzAmud = amud.endsWith("a") ? 0 : 1;
    const steinsaltzSegments = steinsaltzResult.contents[0].content.filter(
      (s: any) => s.amud === steinsaltzAmud);

    const lengthDifferential = segments.length - steinsaltzSegments.length;
    const hadranSegment = segments.findIndex(segment => segment.hadran);
    if (lengthDifferential === 1 && hadranSegment !== -1) {
      steinsaltzSegments.splice(hadranSegment, 0, {notesHeb: [], notesEng: []});
    } else if (lengthDifferential !== 0) {
      this.logger.error("Unequal segment length", segments.length, steinsaltzSegments.length);
      return;
    }

    for (const [segment, steinsaltz] of _.zip(segments, steinsaltzSegments)) {
      let i = 0;
      for (const [hebrew, english] of _.zip(steinsaltz.notesHeb, steinsaltz.notesEng)) {
        i += 1;
        segment.commentary.addComment(new Comment(
          "Steinsaltz In-Depth",
          hebrew ? hebrew.text : "",
          english ? english.text : "",
          `Steinsaltz comment #${i} on ` + segment.ref,
          english ? english.titleEng : "",
          // the hebrew note only supplies the "title" field, and it's not vocalized.
          english ? english.titleHeb : hebrew.title,
        ));
        if (hebrew && hebrew.files.length > 0) {
          this.logger.error(segment.ref, "heb", hebrew.files);
        }
        if (english && english.files.length > 0) {
          this.logger.error(segment.ref, "eng", english.files);
        }
        // TODO: figure out how files are stored
      }
    }
  }

  protected extraSegments(): Section[] {
    if (books.byCanonicalName[this.bookName].end === this.page) {
      return hadranSegments(this.bookName);
    }
    return [];
  }
}

class TanakhApiRequestHandler extends AbstractApiRequestHandler {
  protected makeId(): string {
    return this.page;
  }

  protected makeTitleHebrew(): string {
    const {hebrewName} = books.byCanonicalName[this.bookName];
    const chapter = intToHebrewNumeral(parseInt(this.page));
    return `${hebrewName} ${chapter}`;
  }

  protected translateHebrewText(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    text: sefaria.TextType, ref: string): sefaria.TextType {
    return sefariaTextTypeTransformation(transformTanakhSpacing)(text);
  }

  protected postProcessSegment(segment: InternalSegment): InternalSegment {
    if (typeof segment.hebrew === "string" && isPehSectionEnding(segment.hebrew)) {
      segment.lastSegmentOfSection = true;
    }
    return segment;
  }
}

class WeekdayTorahPortionHandler extends AbstractApiRequestHandler {
  protected makeId(): string {
    return this.page.replace(/\//g, "_");
  }

  protected makeTitleHebrew(): string {
    return "unused";
  }

  protected expandRef(ref: string): string[] {
    const [year, month, day, inIsrael, aliyahNumber] = ref.replace("WeekdayTorah ", "").split("/");
    const date = new JewishCalendar(
      parseInt(year), parseInt(month), parseInt(day), inIsrael === "true");
    return [getWeekdayReading(date)![parseInt(aliyahNumber)]];
  }

  protected postProcessAllSegments(segments: InternalSegment[]): InternalSegment[] {
    for (const segment of segments.slice(0, -1)) {
      segment.defaultMergeWithNext = true;
    }
    return segments;
  }
}

const ANNENU_PARENT_REFS = new Set([
  "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Redemption 1",
  "Siddur Sefard, Weekday Shacharit, Amidah 47",
]);

function aseretYimeiTeshuvaStyle(text: string): string {
  return `<span class="aseret-yimei-teshuva">${text}</span>`;
}

function unsmall(text: string): string {
  return text.replace(/<small>/g, "").replace(/<\/small>/g, "");
}

function createAnnenuSegment() {
  const segment = new InternalSegment({
    hebrew: readUtf8("siddur/annenu.txt"),
    english: "",
    ref: "tp::Annenu",
  });
  segment.commentary.addComment(Comment.create(
    {
      sourceRef: "Isaiah 65:24",
      sourceHeRef: "ישעיהו סה:כב",
      ref: "Isaiah 65:24",
      anchorRef: "Isaiah 65:24",
      anchorRefExpanded: ["Isaiah 65:24"],
      versionTitle: "::injected::",
    }, {
      ref: "Isaiah 65:24",
      he: "וְהָיָ֥ה טֶֽרֶם־יִקְרָ֖אוּ וַאֲנִ֣י אֶעֱנֶ֑ה ע֛וֹד הֵ֥ם מְדַבְּרִ֖ים וַאֲנִ֥י אֶשְׁמָֽע׃",
      text: "Before they pray, I will answer; While they are still speaking, I will respond.",
    },
    "Verses",
    consoleLogger));
  segment.steinsaltz_start_of_sugya = true;
  return segment;
}

abstract class LiturgicalApiRequestHandler extends AbstractApiRequestHandler {
  abstract refRewritingMap(): Record<string, RefPiece[]>;
  abstract book(): Book;

  protected expandRef(ref: string): string[] {
    const suffix = ref.replace(this.book().bookNameForRef() + " ", "");
    if (suffix in this.refRewritingMap()) {
      return this.refRewritingMap()[suffix].map(getRef);
    }
    return super.expandRef(ref);
  }

  protected makeId(): string {
    return this.page.replace(/ /g, "_");
  }

  protected makeSubRef(mainRef: string, index: number): string {
    if (mainRef.includes("Ashkenaz") || mainRef.includes("Sefard") || mainRef.includes("Birkat")) {
      return `${mainRef} ${index + 1}`;
    }
    return `${mainRef}:${index + 1}`;
  }

  protected makeTitle(): string {
    return this.page;
  }

  protected makeTitleHebrew(): string {
    return HEBREW_SECTION_NAMES[this.page];
  }

  stripWeirdHebrew(hebrew: string): string {
    return hebrew
      .replace(/\s?<span class="mam-spi-pe">{פ}<\/span>(<br ?\/?>)?/g, "")
      .replace(/\s?<span class="mam-spi-samekh">{ס}<\/span>\s*/g, "");
  }

  protected translateHebrewText(text: sefaria.TextType, ref: string): sefaria.TextType {
    const transformations = [
      (t: sefaria.TextType) => super.translateHebrewText(t, ref),
      sefariaTextTypeTransformation(this.stripWeirdHebrew),
    ];
    if (!KEEP_TROPE_REFS.has(ref)) {
      transformations.push(sefariaTextTypeTransformation(stripHebrewNonlettersOrVowels));
    }

    for (const transformation of transformations) {
      text = transformation(text);
    }
    return text;
  }

  protected applicableCommentaryNames(): string[] {
    return [
      "Rashi",
      "Shulchan Arukh",
      "Peninei Halakhah",
      "Torah Temima",
      "Verses",
    ];
  }

  protected postProcessSegment(segment: InternalSegment): InternalSegment {
    if (BOLDIFY_REFS.has(segment.ref)) {
      segment.hebrew = `<b>${segment.hebrew}</b>`;
    } else if (segment.ref === "Siddur Sefard, Weekday Shacharit, Amidah 60") {
      // TODO: check is this fix has been applied
      segment.hebrew = (segment.hebrew as string).replace("הַשָׁנִים בָּרוּךְ", "הַשָׁנִים. בָּרוּךְ");
    } else if (segment.ref === "Siddur Sefard, Weekday Shacharit, The Shema 16") {
      const start = "רַחֵם עָלֵֽינוּ";
      const pieces = start.split(" ");
      const replacement = [pieces[0], "נָא", pieces[1]].join(" ");
      segment.hebrew = (segment.hebrew as string).replace(start, replacement);
    } else if (segment.ref === "Siddur Sefard, Weekday Shacharit, Aleinu 2") {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      segment.hebrew = boldPrefix(segment.hebrew as string, "עָלֵֽינוּ לְשַׁבֵּֽחַ");
    } else if (segment.ref === "Siddur Sefard, Weekday Shacharit, Aleinu 3") {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      segment.hebrew = boldPrefix(segment.hebrew as string, "עַל כֵּן");
    }

    if (SMALLIFY_REFS.has(segment.ref)) {
      segment.hebrew = `<small no-hachana>${segment.hebrew}</small>`;
    }

    if (ASERET_YIMEI_TESHUVA_REFS.has(segment.ref)
      // Explanation
      && segment.ref !== "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Patriarchs 5") {
      segment.hebrew = aseretYimeiTeshuvaStyle(segment.hebrew as string);
      segment.english = aseretYimeiTeshuvaStyle(segment.english as string);
    }

    if (segment.ref in SIDDUR_IGNORED_FOOTNOTES) {
      const footnotesValue = SIDDUR_IGNORED_FOOTNOTES[segment.ref];
      const footnotes = Array.isArray(footnotesValue) ? footnotesValue : [footnotesValue];
      for (const footnote of footnotes) {
        const footnoteTag = `<sup>${footnote}</sup>`;
        segment.english = (segment.english as string).replace(footnoteTag, "");
        segment.english = (segment.english as string).replace(`<sup>-${footnote}</sup>`, "");
        for (const comment of segment.commentary.comments) {
          if (typeof comment.hebrew === "string" && typeof comment.english === "string"
            && (comment.hebrew.startsWith(footnoteTag)
              || comment.english.startsWith(footnoteTag))) {
            segment.commentary.removeComment(comment);
          }
        }
      }
    }

    for (const ref of SIDDUR_IGNORED_COMMENTARIES[segment.ref] ?? []) {
      segment.commentary.removeCommentWithRef(ref);
    }

    if (segment.ref in ENGLISH_TEXT_REPLACEMENTS) {
      for (const [before, after] of ENGLISH_TEXT_REPLACEMENTS[segment.ref]) {
        segment.english = (segment.english as string).replace(before, after);
      }
    }
    if (segment.ref in HEBREW_TEXT_REPLACEMENTS) {
      for (const [before, after] of HEBREW_TEXT_REPLACEMENTS[segment.ref]) {
        segment.hebrew = (segment.hebrew as string).replace(before, after);
      }
    }

    if (UNSMALL_REFS.has(segment.ref)) {
      segment.hebrew = unsmall(segment.hebrew as string);
      segment.english = unsmall(segment.english as string);
    }
    if (REALLY_BIG_TEXT_REFS.has(segment.ref)) {
      segment.hebrew = `<span class="really-big-text">${segment.hebrew}</span>`;
    }

    for (const comment of segment.commentary.comments) {
      if (comment.englishName === "Peninei Halakhah"
        && !comment.sourceRef.startsWith("Peninei Halakhah, Prayer")) {
        segment.commentary.removeComment(comment);
      }
    }

    return segment;
  }

  protected postProcessAllSegments(segments: InternalSegment[]): InternalSegment[] {
    const mergeWithNext = new Set(SIDDUR_DEFAULT_MERGE_WITH_NEXT);
    if (this.refRewritingMap()[this.page] === undefined) {
      throw new Error(this.page);
    }
    for (const refPiece of this.refRewritingMap()[this.page]) {
      if (refPiece instanceof MergeWithNext) {
        mergeWithNext.add(refPiece.ref);
      } else if (refPiece instanceof MergeRefsByDefault) {
        for (const mergedRef of Array.from(refPiece.mergedRefs)) {
          mergeWithNext.add(mergedRef);
        }
      }
    }

    for (const segment of segments) {
      if (mergeWithNext.has(segment.ref)) {
        segment.defaultMergeWithNext = true;
      }
    }

    segments = this.removeIgnoredRefsAndMergeMergedRefs(segments);
    segments = this.makeExplanationsIntoComments(segments);
    segments = segments.flatMap(segment => {
      const result = [segment];
      if (ANNENU_PARENT_REFS.has(segment.ref)) {
        result.push(createAnnenuSegment());
      }
      return result;
    });

    for (const [first, second] of _.zip(segments.slice(0, -1), segments.slice(1))) {
      if (first.ref === second.ref && first.hebrew === second.hebrew) {
        first.commentary = new InternalCommentary();
      }
    }

    if (this.page === "Tachanun") {
      for (let i = 0; i < segments.length - 1; i++) {
        const [first, next] = segments.slice(i, i + 2);
        if (first.ref === "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Vidui and 13 Middot 3"
          && first.ref === next.ref) {
          first.defaultMergeWithNext = true;
        }
        if (first.ref === "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Vidui and 13 Middot 9"
          && first.ref === next.ref) {
          next.commentary = new InternalCommentary();
        }
      }
    }
    if (this.page === "Psalm 150") {
      segments.at(-2)!.commentary.removeCommentWithRef("Shulchan Arukh, Orach Chayim 51:7");
    }
    if (this.page === "Korbanot") {
      for (const segment of segments) {
        if (segment.ref === "Exodus 30:7") {
          segment.hebrew = `וְנֶאֱמַר: ${segment.hebrew}`;
          segment.english = `As it is said: ${segment.english}`;
        }
      }
    }
    if (this.page === "Hodu") {
      let i = 0;
      for (const segment of segments) {
        if (segment.ref === "Siddur Sefard, Weekday Shacharit, Hodu 9") {
          if (i === 2) {
            segment.commentary.removeCommentWithRef("Exodus 15:18");
          } else {
            segment.commentary.removeCommentWithRef("Zechariah 14:9");
          }
          i += 1;
        }
      }
    }
    if (this.page === "Sovereignty of Heaven") {
      let i = 0;
      for (const segment of segments) {
        if ([
          "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven 10",
          "Siddur Sefard, Weekday Shacharit, Morning Prayer 14",
        ].includes(segment.ref)) {
          if (i === 0) {
            if (segment.ref.includes("Sefard")) {
              segment.hebrew = (segment.hebrew as string) + ":";
              segment.english = (segment.english as string) + ".";
            }
            segment.commentary.removeCommentWithRef("Zephaniah 3:20");
          } else {
            segment.commentary.removeCommentWithRef("Isaiah 44:6");
            segment.commentary.removeCommentWithRef("Isaiah 11:12");
            segment.commentary.removeCommentWithRef("Isaiah 37:16");
            segment.commentary.removeCommentWithRef("II Kings 19:15");
          }
          segment.commentary.removeCommentWithRef("II Samuel 9:7");
          i += 1;
        }
      }
    }
    return segments;
  }

  private removeIgnoredRefsAndMergeMergedRefs(segments: InternalSegment[]): InternalSegment[] {
    const newSegments = [];
    for (let i = 0; i < segments.length; i++) {
      if (SIDDUR_IGNORED_REFS.has(segments[i].ref)) {
        continue;
      }
      if (segments[i].ref in SIDDUR_MERGE_PAIRS) {
        const mergedSegments = [];
        const endRef = SIDDUR_MERGE_PAIRS[segments[i].ref];
        while (true) { // eslint-disable-line no-constant-condition
          mergedSegments.push(segments[i]);
          if (segments[i].ref === endRef) {
            break;
          }
          i++;
        }
        newSegments.push(InternalSegment.merge(mergedSegments));
      } else {
        newSegments.push(segments[i]);
      }
    }
    return newSegments;
  }

  private makeExplanationsIntoComments(segments: InternalSegment[]): InternalSegment[] {
    const newSegments = [];
    for (let i = 0; i < segments.length - 1; i++) {
      const firstSegment = segments[i];
      const firstSegmentHebrew = firstSegment.hebrew as string;
      if (!firstSegmentHebrew.startsWith("<small>")
        || !firstSegmentHebrew.endsWith("</small>")
        || DONT_MAKE_INTO_EXPLANATIONS.has(firstSegment.ref)) {
        newSegments.push(firstSegment);
        continue;
      }

      const secondSegment = segments[i + 1];
      secondSegment.steinsaltz_start_of_sugya = firstSegment.steinsaltz_start_of_sugya;
      for (const comment of firstSegment.commentary.comments) {
        secondSegment.commentary.addComment(comment);
      }
      secondSegment.commentary.addComment(
        Comment.create({
          sourceRef: firstSegment.ref,
          sourceHeRef: firstSegment.ref,
          ref: firstSegment.ref,
          anchorRef: secondSegment.ref,
          anchorRefExpanded: [secondSegment.ref],
          versionTitle: "",
        }, {
          he: firstSegmentHebrew.replace(/^<small>/, "").replace(/<\/small>$/, ""),
          text: firstSegment.english,
          ref: firstSegment.ref,
        }, "Explanation", this.logger));
    }
    newSegments.push(segments[segments.length - 1]);
    return newSegments;
  }

  protected ignoreLink(mergedSourceRefs: string[], targetRef: string): boolean {
    if (SIDDUR_IGNORED_TARGET_REFS.has(targetRef)) {
      return true;
    }

    if (mergedSourceRefs.includes(
      "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Introductory Psalm 1")) {
      return targetRef.startsWith("Psalms 30:");
    } else if (mergedSourceRefs.includes(
      "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Barukh She'amar 1")) {
      return targetRef === "Shulchan Arukh, Orach Chayim 51:1";
    } else if (targetRef.startsWith("Psalms 105:")
      && mergedSourceRefs.includes("I Chronicles 16:8-26")) {
      return true;
    } else if (targetRef.startsWith("Psalms 100")
      && mergedSourceRefs.filter(x => x.includes("Mizmor Letoda")).length > 0) {
      return true;
    }

    if (mergedSourceRefs
      .filter(sourceRef => SIDDUR_IGNORED_SOURCE_REFS.has(sourceRef))
      .length > 0) {
      return true;
    }
    return super.ignoreLink(mergedSourceRefs, targetRef);
  }
}

function splitAfter(text: string, endText: string): string[] {
  if (!text.includes(endText)) {
    // TODO: this is surely the wrong place to do this. Normalization should probably happen on
    // all inputs..., but that requires some thought.
    text = text.normalize("NFD");
    endText = endText.normalize("NFD");
  }
  if (!text.includes(endText)) {
    throw new Error(`Missing split text: ${text} on ${endText}`);
  }
  const index = text.indexOf(endText) + endText.length;
  return [text.slice(0, index), text.slice(index)];
}

function splitSegmentAfter(
  hebrew: string, english: string, hebrewSplit: string, englishSplit: string): SplitType {
  const hebrewBreaks = splitAfter(hebrew, hebrewSplit);
  const englishBreaks = splitAfter(english, englishSplit);
  return _.zip(hebrewBreaks, englishBreaks) as SplitType;
}

function boldPrefix(text: string, endText: string): string {
  const [prefix, rest] = splitAfter(text, endText);
  return `<b>${prefix}</b>${rest}`;
}

function splitRetain(text: string, splitter: RegExp): string[] {
  const pieces = [];
  while (text.length > 0) {
    const match = text.match(splitter);
    if (!match) {
      pieces.push(text);
      return pieces;
    }
    const splitIndex = match.index! + match[0]!.length;
    pieces.push(text.slice(0, splitIndex));
    text = text.slice(splitIndex);
  }
  return pieces;
}

function splitAshamnu(hebrew: string, english: string): SplitType {
  english = english.replace(
    "; we have joined with evil individuals or groups",
    ", we have joined with evil individuals or groups");
  const [firstHebrew, restHebrew] = splitRetain(hebrew, /<\/b> /);
  const hebrewBreaks = [firstHebrew].concat(splitRetain(restHebrew, /\./));
  return _.zip(hebrewBreaks, splitRetain(english, /[.;] /)) as SplitType;
}

function siddurSplit(ref: string, hebrew: string, english: string): SplitType {
  if (ref in HARDCODED_TEXT) {
    const path = HARDCODED_TEXT[ref];
    if (!path.includes("{lang}")) {
      throw new Error(`${path} does not include "{lang}"`);
    }
    hebrew = readUtf8(path.replace("{lang}", "hebrew"));
    english = readUtf8(path.replace("{lang}", "english"));
  }

  if (ref === "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Barukh She'amar 2") {
    return splitSegmentAfter(hebrew, english, "בָּרוּךְ שְׁמוֹ. ", "blessed is His Name. ");
  } else if (ref === "Siddur Sefard, Weekday Shacharit, Hodu 13") {
    return splitSegmentAfter(hebrew, english, "בָּרוּךְ שְׁמוֹ: ", "blessed is His Name. ");
  } else if (ref === "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Vidui and 13 Middot 3") {
    return splitAshamnu(hebrew, english);
  } else if (ref === "Siddur Ashkenaz, Weekday, Shacharit, Post Amidah, Vidui and 13 Middot 9") {
    return _.zip(splitRetain(hebrew, /[.:]/), splitRetain(english, /(sinned,|\.)/)) as SplitType;
  } else if (ref === "Siddur Sefard, Weekday Shacharit, Amidah 123") {
    const [first, second] = splitSegmentAfter(
      hebrew, english, "וְקַלְקֵל מַחֲשַׁבְתָּם:", "frustrate their intention.");
    const [newSecond, third] = splitSegmentAfter(second[0], second[1], ")", ")");
    return [first, newSecond, third];
  } else if (ref === "Siddur Sefard, Weekday Shacharit, Hodu 9") {
    const [first, second] = splitSegmentAfter(hebrew, english, ": ", ". ");
    first[0] = first[0].trim();
    first[1] = first[1].trim();
    first[0] += "</b>";
    const [newSecond, third] = splitSegmentAfter(second[0], second[1], ":</b>", ".");
    newSecond[0] = "<b>" + newSecond[0];
    return [first, newSecond, third];
  } else if (ref === "Siddur Sefard, Weekday Shacharit, Morning Prayer 14") {
    return splitSegmentAfter(hebrew, english, "ומַה תִּפְעָל", "and what are you making");
  } else if (
    ref === "Siddur Ashkenaz, Weekday, Shacharit, Preparatory Prayers, Sovereignty of Heaven 10") {
    return splitSegmentAfter(hebrew, english, "מַה תַּעֲשֶׂה.", "“What are You doing?”");
  }

  return [[hebrew, english]];
}

class SiddurAshkenazApiRequestHandler extends LiturgicalApiRequestHandler {
  refRewritingMap(): Record<string, RefPiece[]> {
    return SIDDUR_REFS_ASHKENAZ;
  }

  book(): Book {
    return books.byCanonicalName.SiddurAshkenaz;
  }

  protected maybeSplit(ref: string, hebrew: string, english: string): SplitType {
    return siddurSplit(ref, hebrew, english);
  }

  protected postProcessSegment(segment: InternalSegment): InternalSegment {
    segment = super.postProcessSegment(segment);
    if (segment.ref === "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Keduasha 14") {
      segment.hebrew = (segment.hebrew as string).replace(
        "<small>",
        '<small class="aseret-yimei-teshuva">');
    }
    return segment;
  }
}

class SiddurSefardApiRequestHandler extends LiturgicalApiRequestHandler {
  refRewritingMap(): Record<string, RefPiece[]> {
    return SIDDUR_REFS_SEFARD;
  }

  book(): Book {
    return books.byCanonicalName.SiddurSefard;
  }

  protected maybeSplit(ref: string, hebrew: string, english: string): SplitType {
    return siddurSplit(ref, hebrew, english);
  }
}

class BirkatHamazonApiRequestHandler extends LiturgicalApiRequestHandler {
  refRewritingMap(): Record<string, RefPiece[]> {
    return BIRKAT_HAMAZON_REFS;
  }

  book(): Book {
    return books.byCanonicalName.BirkatHamazon;
  }
}

export class ApiRequestHandler {
  private talmudHandlerClass = TalmudApiRequestHandler;
  private tanakhHandlerClass = TanakhApiRequestHandler;
  private siddurAshkenazHandlerClass = SiddurAshkenazApiRequestHandler;
  private siddurSefardHandlerClass = SiddurSefardApiRequestHandler;
  private weekdayTorahHandlerClass = WeekdayTorahPortionHandler;
  private birkatHamazonHandlerClass = BirkatHamazonApiRequestHandler;

  constructor(
    private requestMaker: RequestMaker,
    private logger: Logger = consoleLogger,
  ) {}

  handleRequest(bookName: string, page: string): Promise<ApiResponse> {
    const [handlerClass, isLiturgical] = (() => {
      if (bookName === "SiddurAshkenaz") {
        return [this.siddurAshkenazHandlerClass, true];
      } else if (bookName === "SiddurSefard") {
        return [this.siddurSefardHandlerClass, true];
      } else if (bookName === "WeekdayTorah") {
        return [this.weekdayTorahHandlerClass, false];
      } else if (bookName === "BirkatHamazon") {
        return [this.birkatHamazonHandlerClass, true];
      }
      const clazz = books.byCanonicalName[bookName].isMasechet()
        ? this.talmudHandlerClass
        : this.tanakhHandlerClass;
      return [clazz, false];
    })();

    // This is a small hack around old behavior with the abstract Liturgical base class that rewrote
    // the page value. This doesn't play nicely in Typescript:
    // https://gist.github.com/ronshapiro/c8bb0a34517fbb90f6dddc8972677d65
    if (isLiturgical) {
      page = page.replace(/_/g, " ");
    }

    return new handlerClass(bookName, page, this.requestMaker, this.logger).handleRequest();
  }
}
