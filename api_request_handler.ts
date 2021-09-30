import * as fs from "fs";
import {
  ApiResponse,
  CommentaryMap,
  Section,
  ApiComment,
} from "./apiTypes";
import {books, isLikelyBibleRef, QueryResult} from "./books";
import {ALL_COMMENTARIES, CommentaryType} from "./commentaries";
import {hadranSegments} from "./hadran";
import {stripHebrewNonletters} from "./hebrew";
import {fetch} from "./fetch";
import {Logger, consoleLogger} from "./logger";
import {mergeRefs} from "./ref_merging";
import {refSorter} from "./js/google_drive/ref_sorter";
import {ListMultimap} from "./multimap";
import {
  firstOrOnlyElement,
  sefariaTextTypeTransformation,
} from "./sefariaTextType";
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

  nestedCommentary(parentCommentaryName: string) {
    if (!(parentCommentaryName in this.nestedCommentaries)) {
      this.nestedCommentaries[parentCommentaryName] = new InternalCommentary();
    }
    return this.nestedCommentaries[parentCommentaryName];
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
      result[comment.englishName].comments.push(comment.toJson());
    }

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

    return result;
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

export abstract class AbstractApiRequestHandler {
  constructor(
    protected requestMaker: RequestMaker,
    protected readonly logger: Logger = consoleLogger,
  ) {}

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
    return `${bookName} ${page}`;
  }

  protected translateHebrewText(text: sefaria.TextType): sefaria.TextType {
    return text;
  }

  protected translateEnglishText(text: sefaria.TextType): sefaria.TextType {
    return standardEnglishTransformations(text);
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
        for (const key of Object.keys(linkGraph.graph)) {
          addTextRequestRef(key);
          linkGraph.graph[key].forEach(addTextRequestRef);
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

  private expandRef(ref: string): string[] {
    return [ref];
  }

  private makeTextRequest(ref: string, underlyingRefs: string[]): Promise<sefaria.TextResponse> {
    if (underlyingRefs.length === 1) {
      return this.requestMaker.makeRequest<sefaria.TextResponse>(textRequestEndpoint(ref));
    }
    return this.fetchData(underlyingRefs, ref)
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
            addSegment(he, text, underlyingRefData.ref);
          } else {
            const responseForSpanningRef = {
              he: ([he] as any) as sefaria.TextType,
              text: ([text] as any) as sefaria.TextType,
              spanningRefs: new Array(he.length).fill(underlyingRefData.ref),
              ref: "not-needed",
            };
            for (let i = 0; i < he.length; i++) {
              addSegment(he[i], text[i], this.getSpanningRef(responseForSpanningRef, i));
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
          if (targetRef in linkGraph.graph) {
            continue;
          }
          let sourceRefIndex = Math.min(
            ...mergedRefs.map(x => link.anchorRefExpanded.indexOf(x)).filter(x => x !== -1));
          if (sourceRefIndex === Infinity) {
            sourceRefIndex = 0;
          }
          const sourceRef = link.anchorRefExpanded[sourceRefIndex];
          if (!(sourceRef in linkGraph.graph)) {
            linkGraph.graph[sourceRef] = new Set();
            linkGraph.links[sourceRef] = {};
          }

          const targetRefs = linkGraph.graph[sourceRef]!;
          const commentaryType = this.matchingCommentaryType(link);
          if (targetRefs.has(targetRef) || !commentaryType) {
            continue;
          }
          targetRefs.add(targetRef);
          linkGraph.links[sourceRef][targetRef] = link;

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

  private shouldTraverseNestedRef(commentaryType: CommentaryType, link: sefaria.TextLink): boolean {
    if (commentaryType.allowNestedTraversals) {
      return true;
    }
    return commentaryType.englishName === "Mesorat Hashas" && link.category === "Talmud";
  }

  private fetchData(
    refs: string[],
    requestedRef: string,
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

    for (let i = 0; i < refs.length; i += shardSize) {
      const delimitedRefs = refs.slice(i, i + shardSize).join("|");
      // The tp parameter is helpful for debugging and maintaining stability of recorded test data
      const url = `/bulktext/${delimitedRefs}?useTextFamily=1&tp=${requestedRef}@${i}`;
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
        "Hebrew length != English length",
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
      const segment = new InternalSegment({
        ref,
        hebrew: this.translateHebrewText(hebrew[i]),
        english: this.translateEnglishText(english[i]),
      });
      this.addComments(ref, segment.commentary, linkGraph);
      segments.push(segment);
    }

    segments = segments.map(x => this.postProcessSegment(x));
    segments = this.postProcessAllSegments(segments, bookName, page);

    if (segments.length === 0) {
      this.logger.log(`No segments for ${mainRef}`);
    }

    timer.finish("transformData");

    return {
      id: this.makeId(bookName, page),
      title: this.makeTitle(bookName, page),
      sections: segments.map(x => x.toJson()).concat(this.extraSegments(bookName, page)),
    };
  }

  private addComments(
    ref: string,
    commentary: InternalCommentary,
    linkGraph: LinkGraph,
    cycleChecker: Set<string> = new Set(),
  ) {
    for (const linkRef of Array.from(linkGraph.graph[ref] ?? [])) {
      if (cycleChecker.has(linkRef)) continue;
      const linkResponse = linkGraph.textResponses[linkRef];
      if (!linkResponse || isSefariaError(linkResponse)) continue; // Don't process failed requests
      if (linkResponse.he.length === 0 && linkResponse.text.length === 0) continue;

      const link = linkGraph.links[ref][linkRef];
      const commentaryType = this.matchingCommentaryType(link)!;

      const {comment, footnotes} = FootnotesExtractor.extract(linkResponse);
      commentary.addComment(Comment.create(link, comment, commentaryType.englishName, this.logger));

      for (const footnote of footnotes) {
        commentary.nestedCommentary(commentaryType.englishName).addComment(
          Comment.create(link, footnote, "Footnotes", this.logger));
      }

      cycleChecker.add(ref);
      this.addComments(
        linkRef,
        commentary.nestedCommentary(commentaryType.englishName),
        linkGraph,
        cycleChecker);
      cycleChecker.delete(ref);
    }
  }

  private matchingCommentaryType(link: sefaria.TextLink): CommentaryType | undefined {
    if (!link.collectiveTitle) {
      this.logger.error("No comment title for", link);
      return undefined;
    }
    const name = link.collectiveTitle.en;
    for (const kind of ALL_COMMENTARIES) {
      if (name === kind.englishName
        || hasMatchingProperty(link, kind, "category")
        || hasMatchingProperty(link, kind, "type")
        || (kind.englishNamePattern && kind.englishNamePattern.test(name))) {
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

export class ApiRequestHandler {
  private talmudHandler: TalmudApiRequestHandler;
  private tanakhHandler: TanakhApiRequestHandler;

  constructor(requestMaker: RequestMaker) {
    this.talmudHandler = new TalmudApiRequestHandler(requestMaker);
    this.tanakhHandler = new TanakhApiRequestHandler(requestMaker);
  }

  handleRequest(bookName: string, page: string, logger?: Logger): Promise<ApiResponse> {
    const handler = (
      books.byCanonicalName[bookName].isMasechet()
        ? this.talmudHandler
        : this.tanakhHandler);

    return handler.handleRequest(bookName, page, logger);
  }
}
