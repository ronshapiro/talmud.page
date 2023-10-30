/* global gtag */
import {v4 as uuid} from "uuid";
import {ApiComment, Commentary} from "../../apiTypes";
import {rgbColor} from "./color";
import {refSorter} from "./ref_sorter";
import {DocumentText, extractDocumentText} from "./document_text";
import {GatedExecutor} from "../gated_executor";
import {GoogleApiClient} from "./gapi";
import {insertFormattedTextRequests} from "./insertTextRequests";
import {RetryMethodFactory} from "../retry";
import {insertTableRequests} from "./tableRequests";
import {
  AnyComment,
  CommentSourceMetadata,
  HighlightColor,
  HighlightComment,
  HighlightCommentWithText,
  ParagraphElement,
  PostCommentParams,
  Range,
  Request,
  UnsavedCommentStore,
} from "./types";
import {NullaryFunction} from "../types";
import {checkNotUndefined} from "../undefined";
import {getList} from "./util";

const INSTRUCTIONS_TABLE_RANGE_NAME = "Instructions Table";
const NAMED_RANGE_SEPARATOR = "<<||>>";

const createNamedRange = (name: string, range: Range) => {
  return {createNamedRange: {name, range}};
};

const rangeSorter = (first: Range, second: Range) => {
  if (first.startIndex < second.startIndex) {
    return -1;
  } else if (first.startIndex === second.startIndex) {
    return first.endIndex - second.endIndex;
  } else {
    return 1;
  }
};

// TODO
type TypescriptCleanupType = any;

interface HasContents {
  content: gapi.client.docs.StructuralElement[];
}

interface HasId {
  id: string;
}

interface InternalApiComment extends ApiComment, HasId {}

interface InternalHighlightComment extends HighlightComment, HasId {
  id: string,
  range: Range;
}

function isHighlightComment(comment: AnyComment): comment is HighlightComment {
  return (comment as HighlightComment).highlight !== undefined;
}

function highlightColor(comment: AnyComment): HighlightColor | undefined {
  return (comment as HighlightComment).highlight;
}

interface PostCommentInternalParams extends PostCommentParams {
  id: string;
  isRetry: boolean;
}

interface InternalNamedRange extends HasId {
  startIndex: number;
  endIndex: number;
  joined: boolean | undefined;
}

function commentSourceMetadataNamedRanges(metadata: CommentSourceMetadata): string[] {
  return [
    "startPercentage=" + metadata.startPercentage,
    "endPercentage=" + metadata.endPercentage,
    "wordCountStart=" + metadata.wordCountStart,
    "wordCountEnd=" + metadata.wordCountEnd,
    "isEnglish=" + metadata.isEnglish,
  ];
}

export class DriveClient {
  errors: Record<string, string> = {}
  previousErrors: Record<string, string> = {}
  onErrorListener: NullaryFunction<void> | undefined;

  gapi: GoogleApiClient;

  databaseDocument: gapi.client.docs.Document = {};
  databaseDocumentShouldBeCreated = false;
  documentBodyElements: ParagraphElement[] = [];

  whenDatabaseReady = new GatedExecutor();

  commentsByRef: Record<string, Commentary | undefined> = {};
  commentsBySyntheticRef: Record<string, InternalApiComment> = {};
  rangesByRef: Record<string, InternalNamedRange[]> = {};
  highlightsByRef: Record<string, InternalHighlightComment[]> = {};
  highlightsById: Record<string, InternalHighlightComment> = {};

  unsavedCommentStore: UnsavedCommentStore;

  title: string;
  isDebug: boolean;
  databaseProperty: string;

  signInStatusListener: NullaryFunction<void> | undefined;
  databaseUpdatedListener: NullaryFunction<void> | undefined;
  isSignedIn = false;

  constructor(
    gapi: GoogleApiClient,
    unsavedCommentStore: UnsavedCommentStore,
    title: string,
    isDebug: boolean,
  ) {
    this.gapi = gapi;

    this.resetState();

    this.isDebug = isDebug;
    const databaseType = this.isDebug ? "debug database" : "database";
    this.title = title;
    this.databaseProperty = `${this.title} ${databaseType}`;
    if (this.isDebug) {
      // eslint-disable-next-line no-console
      this.whenDatabaseReady.execute(() => console.log("Debug database document ready!"));
    }

    this.unsavedCommentStore = unsavedCommentStore;
    this.unsavedCommentStore.init(this);
  }

  resetState(): void {
    this.errors = {};
    this.triggerErrorListener();
    this.whenDatabaseReady.reset();
    this.commentsByRef = {};
    this.commentsBySyntheticRef = {};
  }

  retryMethodFactory = new RetryMethodFactory({
    add: (id: string, userVisibleMessage: string) => {
      this.errors[id] = userVisibleMessage;
    },
    remove: (id: string) => {
      delete this.errors[id];
    },
  }, () => this.triggerErrorListener());

  /**
   *  Initializes the API client library and sets up sign-in state
   *  listeners.
   */
  init = this.retryMethodFactory.retryingMethod({
    retryingCall: () => this.gapi.init(),
    then: () => {
      // Set the initial sign-in state.
      this.updateSigninStatus(this.gapi.isSignedIn());

      this.gapi.registerSignInListener((isSignedIn: boolean) => {
        this.updateSigninStatus(isSignedIn);
      });
    },
    createError: () => "Error initializing drive database",
  });

  updateSigninStatus(isSignedIn: boolean): void {
    this.isSignedIn = isSignedIn;
    localStorage.hasSignedInWithGoogle = isSignedIn;
    if (isSignedIn) {
      gtag("config", "GA_MEASUREMENT_ID", {
        user_id: this.gapi.getSignedInUserEmail(),
      });
      this.findDocsDatabase();
    } else {
      this.resetState();
    }
    if (this.signInStatusListener) this.signInStatusListener();
  }

  setDatabaseFileProperties = this.retryMethodFactory.retryingMethod({
    retryingCall: (fileId: string) => {
      checkNotUndefined(fileId, "fileId");
      return this.gapi.setDatabaseFileProperties(fileId, this.databaseProperty);
    },
    createError: () => "Error configuring database file (1y94r)",
  });

  findDocsDatabase = this.retryMethodFactory.retryingMethod({
    retryingCall: () => this.gapi.searchFiles(this.databaseProperty),
    then: (response: TypescriptCleanupType) => {
      const {files} = response.result;
      if (files.length === 0) {
        this.databaseDocumentShouldBeCreated = true;
        if (this.databaseUpdatedListener) this.databaseUpdatedListener();
      } else if (files.length === 1) {
        this.getDatabaseDocument(files[0].id).then(() => this.whenDatabaseReady.declareReady());
      } else {
        this.errors["too many docs"] = "Too many docs";
        this.triggerErrorListener();
      }
    },
    createError: () => "Can't find the notes document",
  });

  createDocsDatabase = this.retryMethodFactory.retryingMethod({
    retryingCall: () => {
      this.databaseDocumentShouldBeCreated = false;
      // i18n: localize this
      const suffix = this.isDebug ? "debug notes" : "notes";
      const title = `talmud.page ${this.title} ${suffix}`;
      return this.gapi.createDocument(title);
    },
    then: (response: TypescriptCleanupType) => {
      return this.getDatabaseDocument(response.result.documentId)
        .then(() => this.addInstructionsTable())
        .then(() => this.setDatabaseFileProperties(response.result.documentId))
        .then(() => this.whenDatabaseReady.declareReady());
    },
    createError: () => "Error creating database file",
  });

  instructionsTableRequests(): Request[] {
    return insertTableRequests({
      tableStart: 1,
      borderColor: rgbColor(184, 145, 48),
      backgroundColor: rgbColor(251, 229, 163),
      cells: [{
        cellText: [
          "This document was created with ",
          {text: "talmud.page", url: "https://talmud.page"},
          " and is used as a database for personalized comments that you create.",
          "\n\n",
          "Before making any edits, it's recommended to read ",
          {text: "these instructions", url: "https://talmud.page/caveats/google-docs"},
          ".",
        ],
      }],
      rangeNames: [INSTRUCTIONS_TABLE_RANGE_NAME],
    });
  }

  addInstructionsTable = this.retryMethodFactory.retryingMethod({
    retryingCall: () => this.updateDocument(this.instructionsTableRequests()),
    then: () => this.refreshDatabaseDocument(),
    createError: () => "Error configuring database file (28zd3)",
  });

  getDatabaseDocument = this.retryMethodFactory.retryingMethod({
    retryingCall: (documentId: string) => {
      this.commentsByRef = {};
      this.commentsBySyntheticRef = {};
      return this.gapi.getDatabaseDocument(documentId);
    },
    then: (document: TypescriptCleanupType) => {
      this.databaseDocument = document!;
      if (!this.databaseDocument.namedRanges) {
        this.databaseDocument.namedRanges = {};
      }
      this.documentBodyElements = (
        this._documentBodyElements(this.databaseDocument.body as HasContents, []));

      this.extractRelevantNamedRanges();

      if (this.databaseUpdatedListener) this.databaseUpdatedListener();
    },
    createError: () => "Could not find database file",
  });

  rangesById(): Record<string, Record<string, Range>> {
    const namedRanges = this.databaseDocument.namedRanges as TypescriptCleanupType;
    const rangesById: Record<string, Record<string, Range>> = {};
    for (const rangeName of Object.keys(namedRanges)) {
      if (rangeName.includes(NAMED_RANGE_SEPARATOR)) {
        const parts = rangeName.split(NAMED_RANGE_SEPARATOR);
        const id = parts[0];
        if (!(id in rangesById)) {
          rangesById[id] = {};
        }
        // eslint-disable-next-line prefer-destructuring
        rangesById[id][parts[2]] = namedRanges[rangeName].namedRanges[0].ranges[0];
      }
    }
    return rangesById;
  }

  extractRelevantNamedRanges(): void {
    const namedRanges = this.databaseDocument.namedRanges as TypescriptCleanupType;
    this.rangesByRef = {};
    const addNamedRanges = (ref: string, rangesToAdd: InternalNamedRange[]) => {
      getList(this.rangesByRef, ref).push(...rangesToAdd);
    };

    this.highlightsByRef = {};
    this.highlightsById = {};
    const rangesById = this.rangesById();

    for (const rangeName of Object.keys(namedRanges)) {
      if (rangeName.startsWith("ref:")) {
        addNamedRanges(
          rangeName.slice("ref:".length),
          namedRanges[rangeName].namedRanges.flatMap((x: any) => x.ranges));
      } else {
        const [id, ref, suffix] = rangeName.split(NAMED_RANGE_SEPARATOR);
        if (!suffix) continue;
        const commentRange = namedRanges[rangeName].namedRanges[0].ranges[0];
        const ranges = rangesById[id];
        if (suffix === "comment") {
          const selectedTextRange = ranges["selected text"];
          if (selectedTextRange) {
            addNamedRanges(ref, [{
              id,
              startIndex: selectedTextRange.startIndex,
              endIndex: commentRange.endIndex,
              joined: true,
            }]);
          } else {
            addNamedRanges(ref, [{...commentRange, id}]);
          }
        } else if (suffix.startsWith("highlight")) {
          const highlightComment = this.extractedHighlightComment(id, commentRange, ranges);
          getList(this.highlightsByRef, ref).push(highlightComment);
          this.highlightsById[id] = highlightComment;
        }
      }
    }

    for (const ranges of Object.values(this.rangesByRef)) {
      ranges.sort(rangeSorter);
    }
  }

  extractedHighlightComment(
    id: string,
    range: Range,
    ranges: Record<string, Range>,
  ): InternalHighlightComment {
    const suffixes: Record<string, string> = {};
    for (const otherSuffix of Object.keys(ranges)) {
      const [key, value] = otherSuffix.split("=");
      suffixes[key] = value;
    }
    return {
      range,
      id,
      highlight: (suffixes.highlight as HighlightColor) ?? "yellow",
      commentSourceMetadata: {
        startPercentage: parseFloat(suffixes.startPercentage),
        endPercentage: parseFloat(suffixes.endPercentage),
        wordCountStart: parseInt(suffixes.wordCountStart),
        wordCountEnd: parseInt(suffixes.wordCountEnd),
        isEnglish: suffixes.isEnglish === "true",
      },
    };
  }

  refreshDatabaseDocument(): Promise<any> {
    return this.getDatabaseDocument(this.databaseDocument.documentId);
  }

  postCommentRequests(
    {comment, selectedText, amud, ref, parentRef}: PostCommentInternalParams,
  ): Request[] {
    let insertLocation = this.findInsertLocation(parentRef);
    const requests = [];

    const headerRangeLabel = `header:${amud}`;
    const headerExists = headerRangeLabel in this.databaseDocument.namedRanges!;
    if (!headerExists) {
      const headerText = amud + "\n";
      const headerRange = {
        startIndex: insertLocation,
        endIndex: insertLocation + headerText.length,
      };
      requests.push(
        ...insertFormattedTextRequests(headerText, headerRange, "HEADING_2"),
        createNamedRange(headerRangeLabel, headerRange));
      insertLocation += headerText.length;
    }

    // don't use the unsaved comment id in case there are mistaken duplicate retries
    const uniqueId = uuid();
    const rangeNameWithSuffix = (suffix: string): string => (
      [uniqueId, ref, suffix].join(NAMED_RANGE_SEPARATOR));

    const cells = [];
    if (ref !== parentRef) {
      cells.push({cellText: [ref]});
    }
    cells.push({
      cellText: [{text: selectedText, bold: true, highlight: highlightColor(comment)}],
      rtl: true,
      rangeNames: (
        [isHighlightComment(comment) ? "highlight=" + highlightColor(comment) : "selected text"]
          .concat(commentSourceMetadataNamedRanges(comment.commentSourceMetadata))
          .map(x => rangeNameWithSuffix(x))
      ),
    });
    if (!isHighlightComment(comment)) {
      cells.push({
        cellText: [comment.text],
        rangeNames: [rangeNameWithSuffix("comment")],
      });
    }

    requests.push(
      ...insertTableRequests({
        cells,
        tableStart: insertLocation,
        rangeNames: [
          // The "parentRef:"-prefixed range helps maintain a readable ordering within the
          // Google Doc. For example, if a comment is added on Pasuk P1 that is referenced in Daf
          // 2a, a note will be added at the end of the Daf 2a section in the Google Doc, since that
          // is where the text was viewed when the note was recorded.
          // Note that because one doc is created per each titled text, comments aren't maintained
          // across titles.
          // "orderingRef:" is probably a better name than parentRef, but parentRef is kept for
          // compatability reasons.
          `parentRef:${parentRef}`,
          `orderingRef:${parentRef}`,
          `fullComment:${uniqueId}`,
        ],
      }),
    );

    return requests;
  }

  postComment(params: PostCommentParams): Promise<any> {
    if (this.databaseDocumentShouldBeCreated) {
      this.createDocsDatabase();
    }

    let {id} = params;
    const isRetry = id !== undefined;
    if (!isRetry) {
      id = this.unsavedCommentStore.addUnsavedComment(params);
      const {amud, ref, parentRef} = params;
      gtag("event", "add_personal_note", {amud, ref, parentRef});
    }

    return this.whenDatabaseReady.execute(
      () => this._postComment({...params, id, isRetry}));
  }

  _postComment = this.retryMethodFactory.retryingMethod({
    retryingCall: (params: PostCommentInternalParams) => {
      return this.updateDocument(this.postCommentRequests(params))
        .finally(() => this.refreshDatabaseDocument())
        .then(response => {
          this.unsavedCommentStore.markCommentSaved(params.id);
          return Promise.resolve(response);
        });
    },
    createError: ({ref, isRetry}: PostCommentParams) => (
      isRetry ? undefined : `Could not save comment on ${ref}`),
  });

  // TODO: tests
  findInsertLocation(parentRef: string): number {
    const namedRanges = this.databaseDocument.namedRanges as TypescriptCleanupType;
    if (Object.keys(namedRanges).length === 0) {
      return this.documentEnd();
    }

    const prefixedRef = `parentRef:${parentRef}`;
    if (prefixedRef in namedRanges) {
      const existingRanges = [...namedRanges[prefixedRef].namedRanges].flatMap(x => x.ranges);
      existingRanges.sort(rangeSorter);
      return existingRanges.at(-1).endIndex;
    }

    const parentRefs = (
      Object.keys(namedRanges)
        .filter(ref => ref.startsWith("parentRef:"))
        .map(ref => ref.substring("parentRef:".length)));
    parentRefs.push(parentRef);
    parentRefs.sort(refSorter);
    const index = parentRefs.indexOf(parentRef);
    if (index !== 0) {
      return this.findInsertLocation(parentRefs[index - 1]);
    }

    if (INSTRUCTIONS_TABLE_RANGE_NAME in namedRanges) {
      return (
        namedRanges[INSTRUCTIONS_TABLE_RANGE_NAME]
          .namedRanges[0]
          .ranges[0]
          .endIndex);
    }

    // As a last resort, insert at the beginning of the document
    return 1;
  }

  documentEnd(): number {
    const content = this.databaseDocument.body!.content as gapi.client.docs.StructuralElement[];
    return content[content.length - 1]!.endIndex! - 1;
  }

  commentsForRef(ref: string): Commentary | undefined {
    if (!this.databaseDocument) {
      return undefined;
    }
    if (ref in this.commentsByRef) {
      return this.commentsByRef[ref];
    } else {
      const comments = this.computeCommentsForRef(ref);
      this.commentsByRef[ref] = comments;
      for (const comment of (comments?.comments || [])) {
        this.commentsBySyntheticRef[comment.ref] = (comment as InternalApiComment);
      }
      return comments;
    }
  }

  private totalLanguageStats(documentText: DocumentText[]): [number, number] {
    const reducer = (x: number, y: number): number => x + y;
    const hebrew = documentText.map(x => x.languageStats.hebrew).reduce(reducer);
    const english = documentText.map(x => x.languageStats.english).reduce(reducer);
    return [hebrew, english];
  }

  computeCommentsForRef(ref: string): Commentary | undefined {
    if (!(ref in this.rangesByRef)) {
      return undefined;
    }
    const ranges = this.rangesByRef[ref] || [];
    return {
      comments: ranges.map((range, index) => {
        const documentText = extractDocumentText(range, this.documentBodyElements);
        const text = documentText.map(x => x.text);
        if (range.joined && text.length > 1) {
          const first = text.shift();
          const second = text.shift();
          text.unshift([first, second].join(" - "));
        }
        const [hebrew, english] = this.totalLanguageStats(documentText);
        return {
          id: range.id,
          en: english > hebrew ? text : "",
          he: hebrew >= english ? text : "",
          ref: `${ref}-personal${index}`,
          sourceRef: ref,
          sourceHeRef: ref,
        };
      }),
    };
  }

  highlightsForRef(ref: string): HighlightCommentWithText[] {
    if (!(ref in this.highlightsByRef)) {
      return [];
    }
    return this.highlightsByRef[ref].map(highlight => {
      return {
        ...highlight,
        text: extractDocumentText(highlight.range, this.documentBodyElements, true)
          .map(x => x.text).join(""),
      };
    });
  }

  // TODO: comment/highlight deletes and updates should also be saved to localStorage for retries
  deleteHighlight = this.retryMethodFactory.retryingMethod({
    retryingCall: (id: string) => {
      const {range} = this.highlightsById[id];
      return this.deleteRange(range).finally(() => this.refreshDatabaseDocument());
    },
    createError: () => "Error deleting highlight",
  });

  _documentBodyElements(contents: HasContents, elements: ParagraphElement[]): ParagraphElement[] {
    contents.content.forEach((content, index) => {
      if (content.paragraph) {
        if (index === 0) {
          const firstElement = content.paragraph.elements![0] as ParagraphElement;
          const initialLength = firstElement.textRun!.content.length;
          firstElement.textRun.content = firstElement.textRun.content.trimStart();
          firstElement.startIndex += initialLength - firstElement.textRun.content.length;
        }
        if ((index + 1) === contents.content.length) {
          const lastElement = content.paragraph.elements!.at(-1) as ParagraphElement;
          const initialLength = lastElement.textRun.content.length;
          lastElement.textRun.content = lastElement.textRun.content!.trimEnd();
          lastElement.endIndex -= initialLength - lastElement.textRun.content!.length;
        }
        elements.push(...(content.paragraph.elements! as ParagraphElement[]));
      } else if (content.table) {
        const cells = content.table.tableRows!.flatMap(x => x.tableCells);
        cells.forEach(x => this._documentBodyElements(x as HasContents, elements));
      }
    });
    return elements;
  }

  deleteComment = this.retryMethodFactory.retryingMethod({
    retryingCall: (ref: string) => {
      const namedRanges = this.databaseDocument.namedRanges as TypescriptCleanupType;
      const range = (
        namedRanges[`fullComment:${this.commentsBySyntheticRef[ref].id}`].namedRanges[0].ranges[0]);
      return this.deleteRange(range).finally(() => this.refreshDatabaseDocument());
    },
    createError: () => "Error deleting personal comment",
  });

  private namedRangeForSyntheticRef(ref: string) {
    const namedRanges = this.databaseDocument.namedRanges as TypescriptCleanupType;
    const comment = this.commentsBySyntheticRef[ref];
    const commentRangeName = [
      comment.id, comment.sourceRef, "comment"].join(NAMED_RANGE_SEPARATOR);
    return namedRanges[commentRangeName].namedRanges[0];
  }

  currentCommentText(ref: string): [string, boolean] {
    const namedRange = this.namedRangeForSyntheticRef(ref);
    const documentText = extractDocumentText(namedRange.ranges[0], this.documentBodyElements, true);
    const [hebrew, english] = this.totalLanguageStats(documentText);
    return [documentText.map(x => x.text).join("\n"), hebrew >= english];
  }

  updateComment = this.retryMethodFactory.retryingMethod({
    retryingCall: (ref: string, newText: string) => {
      const namedRange = this.namedRangeForSyntheticRef(ref);
      const request = {replaceNamedRangeContent: {
        namedRangeId: namedRange.id,
        namedRangeName: namedRange.name,
        text: newText,
      }};
      return this.updateDocument([request])
        .finally(() => this.refreshDatabaseDocument());
    },
    createError: () => "Error editting personal comment",
  });

  signIn(): void {
    localStorage.hasSignedInWithGoogle = "true";
    this.gapi.signIn();
  }

  signOut(): void {
    this.gapi.signOut();
  }

  updateDocument(requests: Request[]): Promise<any> {
    if (!Array.isArray(requests)) {
      requests = [requests];
    }
    return this.gapi.batchUpdate({
      requests,
      documentId: this.databaseDocument.documentId!,
      writeControl: {requiredRevisionId: this.databaseDocument.revisionId},
    });
  }

  private deleteRange(range: Range): Promise<undefined> {
    return this.updateDocument([{deleteContentRange: {range}}]);
  }

  allowCommenting(): boolean {
    return localStorage.hasSignedInWithGoogle === "true" || (this.isSignedIn && !this.hasErrors());
  }

  triggerErrorListener(): void {
    if (!this.previousErrors) {
      this.previousErrors = {};
      return;
    }
    if (!this.onErrorListener) {
      return;
    }

    const previousKeys = Object.keys(this.previousErrors);
    const currentKeys = Object.keys(this.errors);
    const trigger = () => this.onErrorListener && this.onErrorListener();

    if (previousKeys.length !== currentKeys.length
        || currentKeys.filter(k => this.errors[k] !== this.previousErrors[k]).length > 0) {
      trigger();
    }

    this.previousErrors = {...this.errors};
  }

  hasErrors(): boolean {
    return Object.keys(this.errors).length > 0;
  }
}
