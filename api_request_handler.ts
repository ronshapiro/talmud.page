import * as fs from "fs";
import {JewishCalendar} from "kosher-zmanim";
import * as _ from "underscore";
import {
  ApiResponse,
  CommentaryMap,
  Section,
  ApiComment,
} from "./apiTypes";
import {books, isLikelyBibleRef, QueryResult} from "./books";
import {ALL_COMMENTARIES, CommentaryType} from "./commentaries";
import {hadranSegments} from "./hadran";
import {stripHebrewNonletters, stripHebrewNonlettersOrVowels} from "./hebrew";
import {fetch} from "./fetch";
import {Logger, consoleLogger} from "./logger";
import {mergeRefs} from "./ref_merging";
import {refSorter} from "./js/google_drive/ref_sorter";
import {ListMultimap} from "./multimap";
import {
  firstOrOnlyElement,
  sefariaTextTypeTransformation,
} from "./sefariaTextType";
import {
  SEGMENT_SEPERATOR_REF,
  SIDDUR_IGNORED_FOOTNOTES,
  SIDDUR_IGNORED_REFS,
  SIDDUR_IGNORED_SOURCE_REFS,
  SIDDUR_IGNORED_TARGET_REFS,
  SIDDUR_MERGE_PAIRS,
  SIDDUR_REF_REWRITING,
  SYNTHETIC_REFS,
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
import {checkNotUndefined} from "./js/undefined";
import {getWeekdayReading} from "./weekday_parshiot";

export abstract class RequestMaker {
  abstract makeRequest<T>(endpoint: string): Promise<T>;
}

export class RealRequestMaker extends RequestMaker {
  makeRequest<T>(endpoint: string): Promise<T> {
    return fetch(`https://sefaria.org/api${encodeURI(endpoint)}`, {
      retry: {
        retries: 4,
        minTimeout: 200,
      },
    })
      .then(x => x.json())
      .then(json => (json.error ? Promise.reject(json) : Promise.resolve(json)));
  }
}

const standardEnglishTransformations = sefariaTextTypeTransformation(
  english => (
    HtmlNormalizer.process(
      SectionSymbolRemover.process(
        SefariaLinkSanitizer.process(english)))
  ));

function internalLinkableRef(ref: string): QueryResult | undefined {
  for (const title of Object.keys(books.byCanonicalName)) {
    if (ref.startsWith(title)) {
      try {
        return books.parse(ref.split(":")[0]);
      } catch {
        continue;
      }
    }
  }
  return undefined;
}

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

const SHULCHAN_ARUKH_HEADERS: any = (
  JSON.parse(
    fs.readFileSync("precomputed_texts/shulchan_arukh_headings.json", {encoding: "utf-8"}),
  )
);

function shulchanArukhChapterTitle(ref: string): string | undefined {
  const bookAndChapter = ref.split("Shulchan Arukh, ")[1].split(":")[0];
  const separatorIndex = bookAndChapter.lastIndexOf(" ");
  const book = bookAndChapter.slice(0, separatorIndex);
  const chapter = bookAndChapter.slice(separatorIndex + 1);

  if (book.includes(", Seder ")) {
    return undefined;
  }
  return SHULCHAN_ARUKH_HEADERS[book][chapter];
}

function deepEquals(hebrew: sefaria.TextType, english: sefaria.TextType): boolean {
  if (Array.isArray(hebrew) && Array.isArray(english)) {
    if (hebrew.length !== english.length) {
      return false;
    }
    for (let i = 0; i <= hebrew.length; i++) {
      if (!deepEquals(hebrew[i], english[i])) {
        return false;
      }
    }
    return true;
  }

  return hebrew === english;
}

function identityMultimap<E>(elements: E[]): ListMultimap<E, E> {
  const multimap = new ListMultimap<E, E>();
  for (const e of elements) multimap.put(e, e);
  return multimap;
}

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
    if (deepEquals(hebrew, english)) {
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
    return json;
  }
}

const HADRAN_PATTERN = /^((<br>)+<big><strong>)?הדרן עלך .*/;

function isHadran(text: sefaria.TextType): boolean {
  if (Array.isArray(text)) {
    return isHadran(text[0]);
  }
  return HADRAN_PATTERN.test(stripHebrewNonletters(text));
}

function hasMatchingProperty(first: any, second: any, propertyName: string): boolean {
  return propertyName in first
    && propertyName in second
    && first[propertyName] === second[propertyName];
}

class LinkGraph {
  graph: Record<string, Set<string>> = {};
  links: Record<string, Record<string, sefaria.TextLink>> = {}
  textResponses: Record<string, sefaria.TextResponse> = {};
  // TODO(typescript): don't cache the result if the link graph is incomlete
  complete = true;

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

function hasText(textLink: sefaria.TextLink): textLink is sefaria.TextLinkWithText {
  return "he" in textLink && "text" in textLink;
}

const LOTS_OF_NON_BREAKING_SPACES = new RegExp(String.fromCharCode(160) + "{4,}", 'g');

export abstract class AbstractApiRequestHandler {
  private applicableCommentaries: CommentaryType[];

  constructor(
    protected requestMaker: RequestMaker,
    protected readonly logger: Logger = consoleLogger,
  ) {
    this.applicableCommentaries = this.getApplicableCommentaries();
  }

  protected abstract recreateWithLogger(logger: Logger): AbstractApiRequestHandler;

  protected abstract makeId(bookName: string, page: string): string;

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

  protected makeTitle(bookName: string, page: string): string {
    return `${books.byCanonicalName[bookName].canonicalName} ${page}`;
  }

  private replaceLotsOfNonBreakingSpacesWithNewlines(text: string): string {
    return text.replace(LOTS_OF_NON_BREAKING_SPACES, "<br>");
  }

  protected translateHebrewText(text: sefaria.TextType): sefaria.TextType {
    return sefariaTextTypeTransformation(this.replaceLotsOfNonBreakingSpacesWithNewlines)(text);
  }

  protected translateEnglishText(text: sefaria.TextType): sefaria.TextType {
    return standardEnglishTransformations(text);
  }

  protected maybeSplit(ref: string, hebrew: string, english: string): [string, string][] {
    return [[hebrew, english]];
  }

  protected postProcessSegment(segment: InternalSegment): InternalSegment {
    return segment;
  }

  protected postProcessAllSegments(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    segments: InternalSegment[], bookName: string, page: string,
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected extraSegments(bookName: string, page: string): Section[] {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected linkDepth(bookName: string, page: string): number {
    return 2;
  }

  handleRequest(bookName: string, page: string, logger?: Logger): Promise<ApiResponse> {
    if (logger) {
      // @ts-ignore
      return this.recreateWithLogger(logger).handleRequest(bookName, page);
    }

    const book = books.byCanonicalName[bookName];
    const ref = `${book.bookNameForRef()} ${book.rewriteSectionRef(page)}`;
    const underlyingRefs = this.expandRef(ref);

    const textRequest = this.makeTextRequest(ref, underlyingRefs);
    const linksTraversalTimer = this.logger.newTimer();
    const linkGraphRequest = this.linksTraversal(
      new LinkGraph(), identityMultimap(underlyingRefs), this.linkDepth(bookName, page))
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
    ]).then(args => this.transformData(bookName, page, ...args));
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
          const {he, text} = underlyingRefData;
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
            const lastSpace = underlyingRef.lastIndexOf(" ");
            const baseRef = underlyingRef.slice(0, lastSpace);
            const [start, end] = underlyingRef.slice(lastSpace + 1).split("-");

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
    return `/links/${ref}?with_text=${isLikelyBibleRef(ref) ? 0 : 1}`;
  }

  private linksTraversal(
    linkGraph: LinkGraph,
    refsInRound: ListMultimap<string, string>,
    remainingDepth: number,
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
          const sourceRef = link.anchorRefExpanded[sourceRefIndex];
          const targetRefs = linkGraph.getGraph(sourceRef);
          const commentaryType = this.matchingCommentaryType(link);
          if (targetRefs.has(targetRef) || !commentaryType) {
            continue;
          }
          linkGraph.addLink(sourceRef, link);

          // If after link traversal https://github.com/Sefaria/Sefaria-Project/issues/616 is
          // implemented, with_text can always be set to 0 and then all fetching deferred to
          if (hasText(link)) {
            linkGraph.textResponses[targetRef] = {
              ref: link.ref,
              text: link.text,
              he: link.he,
            };
          }

          if (remainingDepth !== 0 && this.shouldTraverseNestedRef(commentaryType, link)) {
            nextRefs.push(targetRef);
          }
        }
      }
      return this.linksTraversal(linkGraph, mergeRefs(nextRefs), remainingDepth - 1);
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected ignoreLink(mergedSourceRefs: string[], targetRef: string): boolean {
    return false;
  }

  private shouldTraverseNestedRef(commentaryType: CommentaryType, link: sefaria.TextLink): boolean {
    if (commentaryType.allowNestedTraversals) {
      return true;
    }
    return commentaryType.englishName === "Mesorat Hashas" && link.category === "Talmud";
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
    bookName: string,
    page: string,
    textResponse: sefaria.TextResponse,
    linkGraph: LinkGraph,
  ): ApiResponse {
    const timer = this.logger.newTimer();
    const mainRef = textResponse.ref;

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
          hebrew: this.translateHebrewText(footnotesResult.comment.he),
          english: this.translateEnglishText(footnotesResult.comment.text),
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
    segments = this.postProcessAllSegments(segments, bookName, page);

    if (segments.length === 0) {
      this.logger.log(`No segments for ${mainRef}`);
    }

    timer.finish("transformData");

    return {
      id: checkNotUndefined(this.makeId(bookName, page), "makeId"),
      title: checkNotUndefined(this.makeTitle(bookName, page), "title"),
      sections: segments.map(x => x.toJson()).concat(this.extraSegments(bookName, page)),
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

const ALEPH = "א";
const TAV = "ת";
const STEINSALTZ_SUGYA_START = new RegExp(`^<big>[${ALEPH}-${TAV}].*`);

class TalmudApiRequestHandler extends AbstractApiRequestHandler {
  protected recreateWithLogger(logger: Logger): AbstractApiRequestHandler {
    return new TalmudApiRequestHandler(this.requestMaker, logger);
  }

  protected makeId(bookName: string, page: string): string {
    return page;
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
      segment.commentary = new InternalCommentary();
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
    masechet: string,
    amud: string,
  ): InternalSegment[] {
    if (masechet === "Nazir" && amud === "33b") {
      return [new InternalSegment({
        hebrew: "אין גמרא לנזיר ל״ג ע״א, רק תוספות (שהם קשורים לדפים אחרים)",
        english: "Nazir 33b has no Gemara, just Tosafot (which are linked to other pages).",
        ref: "synthetic",
      })];
    }
    return segments;
  }

  protected extraSegments(masechet: string, amud: string): Section[] {
    if (books.byCanonicalName[masechet].end === amud) {
      return hadranSegments(masechet);
    }
    return [];
  }
}

class TanakhApiRequestHandler extends AbstractApiRequestHandler {
  protected recreateWithLogger(logger: Logger): AbstractApiRequestHandler {
    return new TanakhApiRequestHandler(this.requestMaker, logger);
  }

  protected makeId(bookName: string, page: string): string {
    return page;
  }
}

class WeekdayTorahPortionHandler extends AbstractApiRequestHandler {
  protected recreateWithLogger(logger: Logger): AbstractApiRequestHandler {
    return new WeekdayTorahPortionHandler(this.requestMaker, logger);
  }

  protected makeId(bookName: string, page: string): string {
    return page.replace(/\//g, "_");
  }

  protected expandRef(ref: string): string[] {
    const [year, month, day, inIsrael, aliyahNumber] = ref.replace("WeekdayTorah ", "").split("/");
    const date = new JewishCalendar(
      parseInt(year), parseInt(month), parseInt(day), inIsrael === "true");
    return [getWeekdayReading(date)![parseInt(aliyahNumber)]];
  }
}

class SiddurApiRequestHandler extends AbstractApiRequestHandler {
  protected recreateWithLogger(logger: Logger): AbstractApiRequestHandler {
    return new SiddurApiRequestHandler(this.requestMaker, logger);
  }

  handleRequest(bookName: string, page: string, logger?: Logger): Promise<ApiResponse> {
    return super.handleRequest(bookName, page.replace(/_/g, " "), logger);
  }

  protected expandRef(ref: string): string[] {
    const book = books.byCanonicalName.SiddurAshkenaz;
    const suffix = ref.replace(book.bookNameForRef() + " ", "");
    if (suffix in SIDDUR_REF_REWRITING) {
      return SIDDUR_REF_REWRITING[suffix];
    }
    return super.expandRef(ref);
  }

  protected makeId(bookName: string, page: string): string {
    return page.replace(/ /g, "_");
  }

  protected makeSubRef(mainRef: string, index: number): string {
    return (mainRef.includes("Ashkenaz")
      ? `${mainRef} ${index + 1}`
      : `${mainRef}:${index + 1}`);
  }

  protected makeTitle(bookName: string, page: string): string {
    return page;
  }

  stripWeirdHebrew(hebrew: string): string {
    return stripHebrewNonlettersOrVowels(
      hebrew
        .replace(/\s?<span>{פ}<\/span>(<br>)?/g, "")
        .replace(/<span>{ס}<\/span>\s+/g, ""));
  }

  protected translateHebrewText(text: sefaria.TextType): sefaria.TextType {
    return sefariaTextTypeTransformation(this.stripWeirdHebrew)(super.translateHebrewText(text));
  }

  protected applicableCommentaryNames(): string[] {
    return [
      "Rashi",
      "Shulchan Arukh",
      "Verses",
    ];
  }

  protected maybeSplit(ref: string, hebrew: string, english: string): [string, string][] {
    function splitAfter(text: string, endText: string) {
      const index = text.indexOf(endText) + endText.length;
      return [text.slice(0, index), text.slice(index)];
    }
    if (ref === "Siddur Ashkenaz, Weekday, Shacharit, Pesukei Dezimra, Barukh She'amar 2") {
      const hebrewBreaks = splitAfter(hebrew, "בָּרוּךְ שְׁמוֹ. ");
      const englishBreaks = splitAfter(english, "blessed is His Name. ");
      return _.zip(hebrewBreaks, englishBreaks) as [string, string][];
    }
    return super.maybeSplit(ref, hebrew, english);
  }

  protected postProcessSegment(segment: InternalSegment): InternalSegment {
    if (segment.ref === "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Keduasha 14") {
      segment.hebrew = (segment.hebrew as string).replace(
        "<small>",
        '<small class="aseret-yimei-teshuva">');
    }
    if (!(segment.ref in SIDDUR_IGNORED_FOOTNOTES)) {
      return segment;
    }
    const footnotesValue = SIDDUR_IGNORED_FOOTNOTES[segment.ref];
    const footnotes = Array.isArray(footnotesValue) ? footnotesValue : [footnotesValue];
    for (const footnote of footnotes) {
      const footnoteTag = `<sup>${footnote}</sup>`;
      segment.english = (segment.english as string).replace(footnoteTag, "");
      segment.english = (segment.english as string).replace(`<sup>-${footnote}</sup>`, "");
      for (const comment of segment.commentary.comments) {
        if (typeof comment.hebrew === "string" && typeof comment.english === "string"
          && (comment.hebrew.startsWith(footnoteTag) || comment.english.startsWith(footnoteTag))) {
          segment.commentary.removeComment(comment);
        }
      }
    }
    return segment;
  }

  protected postProcessAllSegments(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    segments: InternalSegment[], bookName: string, page: string,
  ): InternalSegment[] {
    segments = this.removeIgnoredRefsAndMergeMergedRefs(segments);
    segments = this.makeExplanationsIntoComments(segments);
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
        || firstSegment.ref === "Siddur Ashkenaz, Weekday, Shacharit, Amidah, Thanksgiving 4") {
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

export class ApiRequestHandler {
  private talmudHandler: TalmudApiRequestHandler;
  private tanakhHandler: TanakhApiRequestHandler;
  private siddurHandler: SiddurApiRequestHandler;
  private weekdayTorahHandler: WeekdayTorahPortionHandler;

  constructor(requestMaker: RequestMaker) {
    this.talmudHandler = new TalmudApiRequestHandler(requestMaker);
    this.tanakhHandler = new TanakhApiRequestHandler(requestMaker);
    this.siddurHandler = new SiddurApiRequestHandler(requestMaker);
    this.weekdayTorahHandler = new WeekdayTorahPortionHandler(requestMaker);
  }

  handleRequest(bookName: string, page: string, logger?: Logger): Promise<ApiResponse> {
    const handler = (() => {
      if (bookName === "SiddurAshkenaz") {
        return this.siddurHandler;
      } else if (bookName === "WeekdayTorah") {
        return this.weekdayTorahHandler;
      }
      return books.byCanonicalName[bookName].isMasechet()
        ? this.talmudHandler
        : this.tanakhHandler;
    })();

    return handler.handleRequest(bookName, page, logger);
  }
}
