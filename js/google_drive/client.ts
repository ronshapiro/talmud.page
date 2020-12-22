/* global gtag */
import {v4 as uuid} from "uuid";
import {Commentary} from "../apiTypes";
import {rgbColor} from "./color";
import {refSorter} from "./ref_sorter";
import {extractDocumentText} from "./document_text";
import {GatedExecutor} from "../gated_executor";
import {GoogleApiClient} from "./gapi";
import {insertFormattedTextRequests} from "./insertTextRequests";
// @ts-ignore
import {RetryMethodFactory} from "../retry.ts";
// @ts-ignore
import {insertTableRequests} from "./tableRequests.ts";
import {
  AnyComment,
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

interface HighlightCommentWithRange extends HighlightComment {
  range: Range;
}

function isHighlightComment(comment: AnyComment): comment is HighlightComment {
  return (comment as HighlightComment).highlight !== undefined;
}

interface PostCommentInternalParams extends PostCommentParams {
  id: string;
  isRetry: boolean;
}

interface InternalNamedRange {
  startIndex: number;
  endIndex: number;
  joined: boolean | undefined;
}

function highlightCommentNamedRanges(comment: HighlightComment): string[] {
  return [
    "highlight",
    "startPercentage=" + comment.startPercentage,
    "endPercentage=" + comment.endPercentage,
    "wordCountStart=" + comment.wordCountStart,
    "wordCountEnd=" + comment.wordCountEnd,
    "isEnglish=" + comment.isEnglish,
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
  rangesByRef: Record<string, InternalNamedRange[]> = {};
  highlightsByRef: Record<string, HighlightCommentWithRange[]> = {};

  unsavedCommentStore: UnsavedCommentStore;

  masechet: string;
  isDebug: boolean;
  databaseProperty: string;

  signInStatusListener: NullaryFunction<void> | undefined;
  databaseUpdatedListener: NullaryFunction<void> | undefined;
  isSignedIn = false;

  constructor(
    gapi: GoogleApiClient,
    unsavedCommentStore: UnsavedCommentStore,
    masechet: string,
    isDebug: boolean,
  ) {
    this.gapi = gapi;

    this.resetState();

    this.isDebug = isDebug;
    const databaseType = this.isDebug ? "debug database" : "database";
    this.masechet = masechet;
    this.databaseProperty = `${this.masechet} ${databaseType}`;
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
      // TODO: localize this
      const title = this.isDebug
            ? `talmud.page ${this.masechet} debug notes`
            : `talmud.page ${this.masechet} notes`;
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
      if (rangeName.indexOf(NAMED_RANGE_SEPARATOR) !== -1) {
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
              startIndex: selectedTextRange.startIndex,
              endIndex: commentRange.endIndex,
              joined: true,
            }]);
          } else {
            addNamedRanges(ref, [commentRange]);
          }
        } else if (suffix === "highlight") {
          getList(this.highlightsByRef, ref)
            .push(this.extractedHighlightComment(commentRange, ranges));
        }
      }
    }

    for (const ranges of Object.values(this.rangesByRef)) {
      ranges.sort(rangeSorter);
    }
  }

  extractedHighlightComment(
    range: Range,
    ranges: Record<string, Range>,
  ): HighlightCommentWithRange {
    const suffixes: Record<string, string> = {};
    for (const otherSuffix of Object.keys(ranges)) {
      const [key, value] = otherSuffix.split("=");
      suffixes[key] = value;
    }
    return {
      range,
      startPercentage: parseFloat(suffixes.startPercentage),
      endPercentage: parseFloat(suffixes.endPercentage),
      wordCountStart: parseInt(suffixes.wordCountStart),
      wordCountEnd: parseInt(suffixes.wordCountEnd),
      isEnglish: suffixes.isEnglish === "true",
      highlight: true,
    };
  }

  refreshDatabaseDocument(): Promise<any> {
    return this.getDatabaseDocument(this.databaseDocument.documentId);
  }

  // TODO(drive): break up this method, possibly by extracting a state object.
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
      cellText: [{text: selectedText, bold: true, highlight: isHighlightComment(comment)}],
      rtl: true,
      rangeNames: (
        (isHighlightComment(comment) ? highlightCommentNamedRanges(comment) : ["selected text"])
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
          // "fullComment:" is not used yet, but seems like a good future-proof tag to have.
          `parentRef:${parentRef}`,
          `orderingRef:${parentRef}`,
          `fullComment:${uniqueId}`,
        ],
      }),
    );

    return requests;
  }

  postComment(params: PostCommentParams): void {
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

    this.whenDatabaseReady.execute(
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

  // TODO(drive): tests, and dependency injection?
  findInsertLocation(parentRef: string): number {
    const namedRanges = this.databaseDocument.namedRanges as TypescriptCleanupType;
    if (Object.keys(namedRanges).length === 0) {
      return this.documentEnd();
    }

    const prefixedRef = `parentRef:${parentRef}`;
    if (prefixedRef in namedRanges) {
      const existingRanges = [...namedRanges[prefixedRef].namedRanges].flatMap(x => x.ranges);
      existingRanges.sort(rangeSorter);
      return existingRanges.slice(-1)[0].endIndex;
    }

    const parentRefs = Object.keys(namedRanges)
          .filter(ref => ref.startsWith("parentRef:"))
          .map(ref => ref.substring("parentRef:".length));
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
      return comments;
    }
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
        const reducer = (x: number, y: number): number => x + y;
        const hebrew = documentText.map(x => x.languageStats.hebrew).reduce(reducer);
        const english = documentText.map(x => x.languageStats.english).reduce(reducer);
        return {
          en: english > hebrew ? text : "",
          he: hebrew >= english ? text : "",
          ref: `${ref}-personal${index}`,
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
          const lastElement = content.paragraph.elements!.slice(-1)[0] as ParagraphElement;
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
        || currentKeys.filter(k => this.errors[k] !== this.previousErrors[k]).length) {
      trigger();
    }

    this.previousErrors = {...this.errors};
  }
}
