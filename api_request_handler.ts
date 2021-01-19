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
import {promiseParts} from "./js/promises";
import {Logger, consoleLogger} from "./logger";
import {mergeRefs} from "./ref_merging";
import {
  firstOrOnlyElement,
  sefariaTextTypeTransformation,
} from "./sefariaTextType";
import {CommentaryParenthesesTransformer} from "./source_formatting/commentary_parentheses";
import {CommentaryPrefixStripper} from "./source_formatting/commentary_prefixes";
import {boldDibureiHamatchil} from "./source_formatting/dibur_hamatchil";
import {FootnotesExtractor} from "./source_formatting/footnotes";
import {HebrewSmallToEmphasisTagTranslator} from "./source_formatting/hebrew_small_to_emphasis";
import {HtmlNormalizer} from "./source_formatting/html_normalizer";
import {ImageNumberingFormatter} from "./source_formatting/image_numbering";
import {JastrowReformatter} from "./source_formatting/jastrow";
import {formatOtzarLaazeiRashi} from "./source_formatting/otzar_laazei_rashi";
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
      hebrew = formatOtzarLaazeiRashi(hebrew);
    }

    hebrew = boldDibureiHamatchil(hebrew, englishName);
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

const HADRAN_PATTERN = /^(<br>)+<big><strong>הדרן עלך .*/;

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
    return `${mainRef}:${index + 1}`;
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

    const ref = `${bookName} ${page}`;
    const textRequest = (
      this.requestMaker.makeRequest<sefaria.TextResponse>(textRequestEndpoint(ref)));
    const linksTraversalTimer = this.logger.newTimer();
    const linkGraphRequest = this.linksTraversal(
      new LinkGraph(), ref, [ref], this.linkDepth(bookName, page), [ref])
      .finally(() => linksTraversalTimer.finish("links traversal"));
    return Promise.all([
      textRequest,
      linkGraphRequest.then(linkGraph => {
        const textRequestRefs = new Set<string>();
        const addTextRequestRef = (requestRef: string) => {
          if (!(requestRef in linkGraph.textResponses) && !requestRef.startsWith(ref)) {
            textRequestRefs.add(requestRef);
          }
        };
        for (const key of Object.keys(linkGraph.graph)) {
          addTextRequestRef(key);
          linkGraph.graph[key].forEach(addTextRequestRef);
        }

        return this.fetchData(Array.from(textRequestRefs))
          .then(fetched => {
            for (const [fetchedRef, textResponse] of Object.entries(fetched)) {
              linkGraph.textResponses[fetchedRef] = textResponse;
            }
          })
          .then(() => linkGraph);
      }),
    ]).then(args => this.transformData(bookName, page, ...args));
  }

  private linksRequestUrl(ref: string) {
    return `/links/${ref}?with_text=${isLikelyBibleRef(ref) ? 0 : 1}`;
  }

  private linksTraversal(
    linkGraph: LinkGraph,
    refToRequest: string,
    refs: string[],
    remainingDepth: number,
    refHierarchy: string[],
  ): Promise<LinkGraph> {
    const [promise, finish, onError] = promiseParts<LinkGraph>();
    const url = this.linksRequestUrl(refToRequest);
    this.requestMaker.makeRequest<sefaria.TextLink[] | sefaria.ErrorResponse>(url)
      .then(linksResponse => {
        if (isSefariaError(linksResponse)) {
          throw new Error(linksResponse.error);
        }

        const nextRefs: string[] = [];
        for (const link of linksResponse) {
          const targetRef = link.ref;
          if (refHierarchy.includes(targetRef) || refHierarchy.some(x => targetRef.startsWith(x))) {
            continue;
          }

          let sourceRefIndex = Math.min(
            ...refs.map(x => link.anchorRefExpanded.indexOf(x)).filter(x => x !== -1));
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

          if (remainingDepth !== 0 && commentaryType.allowNestedTraversals) {
            nextRefs.push(targetRef);
          }
        }

        const nestedPromises: Promise<unknown>[] = [];
        const merged = mergeRefs(nextRefs).asMap();
        for (const [ref, subrefs] of Array.from(merged.entries())) {
          nestedPromises.push(
            this.linksTraversal(
              linkGraph, ref, subrefs, remainingDepth - 1, [...refHierarchy, ...subrefs]));
        }

        Promise.allSettled(nestedPromises).then(() => finish(linkGraph));
      })
      .catch(error => {
        this.logger.error(`Links request error: ${url}`, error);
        linkGraph.complete = false;
        if (refHierarchy.length === 1) {
          // If there will be zero links, it's probably a good reason to fail the request altogether
          onError(error);
        } else {
          finish(linkGraph);
        }
      });

    return promise;
  }

  private fetchData(refs: string[]): Promise<Record<string, sefaria.TextResponse>> {
    if (refs.length === 0) {
      return Promise.resolve({});
    }

    const timer = this.logger.newTimer();
    const fetched: Record<string, sefaria.TextResponse> = {};
    const nestedPromises: Promise<unknown>[] = [];

    const merged = mergeRefs(refs).asMap();
    this.logger.debug("reduction", (refs.length - merged.size) / refs.length);

    for (const [ref, subrefs] of Array.from(merged.entries())) {
      nestedPromises.push(
        this.requestMaker.makeRequest<sefaria.TextResponse>(textRequestEndpoint(ref))
          .then(response => {
            if (subrefs.length === 1) {
              fetched[subrefs[0]] = response;
              return;
            }

            const refIndex = (someRef: string) => (
              parseInt(someRef.substring(someRef.lastIndexOf(":") + 1)));
            const offset = refIndex(subrefs[0]);
            for (const subref of subrefs) {
              const index = refIndex(subref) - offset;
              fetched[subref] = {
                he: response.he[index] ?? (typeof response.text[index] === "string" ? "" : []),
                text: response.text[index] ?? (typeof response.he[index] === "string" ? "" : []),
                ref: subref,
              };
            }
            fetched[ref] = response;
          }));
    }
    return Promise.allSettled(nestedPromises)
      .then(() => fetched)
      .finally(() => timer.finish("fetching secondary texts"));
  }

  private transformData(
    bookName: string,
    page: string,
    textResponse: sefaria.TextResponse,
    linkGraph: LinkGraph,
  ): ApiResponse {
    const timer = this.logger.newTimer();
    const mainRef = textResponse.ref;
    const hebrew = textResponse.he as string[];
    const english = textResponse.text as string[];

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

    let segments: InternalSegment[] = [];
    for (let i = 0; i < hebrew.length; i++) {
      const ref = this.makeSubRef(mainRef, i);
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
  ) {
    for (const linkRef of Array.from(linkGraph.graph[ref] ?? [])) {
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

      this.addComments(
        linkRef,
        commentary.nestedCommentary(commentaryType.englishName),
        linkGraph);
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
        || (kind.englishNamePattern && name.match(kind.englishNamePattern))) {
        return kind;
      }
    }
    return undefined;
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
    "Maharsha", "Maharshal", "Meir Lublin", "Otzar Laazei Rashi"]);

  private removalStrategy(
    topLevelComment: Comment,
    nestedComment: Comment,
  ): RemovalStrategy | undefined {
    if (topLevelComment.englishName === "Verses") {
      // Maybe these shouldn't be removed at all, as verses are typically shorter, and
      // duplicates can be useful
      return RemovalStrategy.REMOVE_NESTED;
    } else if (TalmudApiRequestHandler.REMOVE_TOP_LEVEL_KINDS.has(nestedComment.englishName)) {
      return RemovalStrategy.REMOVE_TOP_LEVEL;
    }

    this.logger.log(
      `Duplicated comment`,
      `Ref: ${topLevelComment.ref}) on ${topLevelComment.sourceRef} and ${nestedComment.ref}`);
    return undefined;
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
