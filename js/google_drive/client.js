/* global gtag */
import {v4 as uuid} from "uuid";
import {rgbColor} from "./color.ts";
import {refSorter} from "./ref_sorter.ts";
import {extractDocumentText} from "./document_text.ts";
import {GatedExecutor} from "../gated_executor.ts";
import {insertFormattedTextRequests} from "./insertTextRequests.ts";
import {RetryMethodFactory} from "../retry.ts";
import {insertTableRequests} from "./tableRequests.ts";
import {checkNotUndefined} from "../undefined.ts";

const INSTRUCTIONS_TABLE_RANGE_NAME = "Instructions Table";
const NAMED_RANGE_SEPARATOR = "<<||>>";

const createNamedRange = (name, range) => {
  return {createNamedRange: {name, range}};
};

const rangeSorter = (first, second) => {
  if (first.startIndex < second.startIndex) {
    return -1;
  } else if (first.startIndex === second.startIndex) {
    return first.endIndex - second.endIndex;
  } else {
    return 1;
  }
};

export class DriveClient {
  constructor(gapi, unsavedCommentStore, masechet, isDebug) {
    this.gapi = gapi;
    this.whenDatabaseReady = new GatedExecutor();
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

  resetState() {
    this.errors = {};
    this.triggerErrorListener();
    this.whenDatabaseReady.reset();
    this.commentsByRef = undefined;
  }

  retryMethodFactory = new RetryMethodFactory({
    add: (id, userVisibleMessage) => {
      this.errors[id] = userVisibleMessage;
    },
    remove: (id) => {
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

      this.gapi.registerSignInListener(isSignedIn => {
        this.updateSigninStatus(isSignedIn);
      });
    },
    createError: () => "Error initializing drive database",
  });

  updateSigninStatus(isSignedIn) {
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
    retryingCall: (fileId) => {
      checkNotUndefined(fileId, "fileId");
      return this.gapi.setDatabaseFileProperties(fileId, this.databaseProperty);
    },
    createError: () => "Error configuring database file (1y94r)",
  });

  findDocsDatabase = this.retryMethodFactory.retryingMethod({
    retryingCall: () => this.gapi.searchFiles(this.databaseProperty),
    then: response => {
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
    then: response => {
      return this.getDatabaseDocument(response.result.documentId)
        .then(() => this.addInstructionsTable())
        .then(() => this.setDatabaseFileProperties(response.result.documentId))
        .then(() => this.whenDatabaseReady.declareReady());
    },
    createError: () => "Error creating database file",
  });

  instructionsTableRequests() {
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
    retryingCall: (documentId) => {
      this.commentsByRef = {};
      return this.gapi.getDatabaseDocument(documentId);
    },
    then: document => {
      this.databaseDocument = document;
      if (!this.databaseDocument.namedRanges) {
        this.databaseDocument.namedRanges = {};
      }

      this.setRangesByRef();

      if (this.databaseUpdatedListener) this.databaseUpdatedListener();
    },
    createError: () => "Could not find database file",
  });

  setRangesByRef() {
    const {namedRanges} = this.databaseDocument;
    this.rangesByRef = {};
    const addNamedRanges = (ref, rangesToAdd) => {
      if (!(ref in this.rangesByRef)) {
        this.rangesByRef[ref] = [];
      }
      this.rangesByRef[ref].push(...rangesToAdd);
    };
    const v2Suffix = NAMED_RANGE_SEPARATOR + "comment";
    for (const rangeName of Object.keys(namedRanges)) {
      if (rangeName.startsWith("ref:")) {
        addNamedRanges(
          rangeName.slice("ref:".length),
          namedRanges[rangeName].namedRanges.flatMap(x => x.ranges));
      } else if (rangeName.endsWith(v2Suffix)) {
        const commentRange = namedRanges[rangeName].namedRanges[0].ranges[0];
        const [id, ref] = rangeName.split(NAMED_RANGE_SEPARATOR).slice(0, 2);
        const selectedTextRangeName = [id, ref, "selected text"].join(NAMED_RANGE_SEPARATOR);
        if (selectedTextRangeName in namedRanges) {
          const selectedTextRange = namedRanges[selectedTextRangeName].namedRanges[0].ranges[0];
          addNamedRanges(ref, [{
            startIndex: selectedTextRange.startIndex,
            endIndex: commentRange.endIndex,
            joined: true,
          }]);
        } else {
          addNamedRanges(ref, [commentRange]);
        }
      }
    }

    for (const ranges of Object.values(this.rangesByRef)) {
      ranges.sort(rangeSorter);
    }
  }

  refreshDatabaseDocument = () => this.getDatabaseDocument(this.databaseDocument.documentId);

  // TODO(drive): break up this method, possibly by extracting a state object.
  postCommentRequests(text, selectedText, amud, ref, parentRef) {
    let insertLocation = this.findInsertLocation(parentRef);
    const requests = [];

    const headerRangeLabel = `header:${amud}`;
    const headerExists = headerRangeLabel in this.databaseDocument.namedRanges;
    if (!headerExists) {
      const headerText = amud;
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
    const rangeNameWithSuffix = (suffix) => [uniqueId, ref, suffix].join(NAMED_RANGE_SEPARATOR);

    requests.push(
      ...insertTableRequests({
        cells: [
          ref !== parentRef ? {cellText: [ref]} : undefined,
          {
            cellText: [{text: selectedText, bold: true}],
            rtl: true,
            rangeNames: [rangeNameWithSuffix("selected text")],
          },
          {cellText: [text], rangeNames: [rangeNameWithSuffix("comment")]},
        ].filter(x => x),
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

  // These parameters should be kept in sync with addUnsavedComment() with the exception of `id`.
  postComment({text, selectedText, amud, ref, parentRef, id}) {
    if (this.databaseDocumentShouldBeCreated) {
      this.createDocsDatabase();
    }

    const isRetry = id !== undefined;
    if (!isRetry) {
      id = this.unsavedCommentStore.addUnsavedComment({text, selectedText, amud, ref, parentRef});
      gtag("event", "add_personal_note", {amud, ref, parentRef});
    }

    this.whenDatabaseReady.execute(
      () => this._postComment({text, selectedText, amud, ref, parentRef, id, isRetry}));
  }

  _postComment = this.retryMethodFactory.retryingMethod({
    retryingCall: ({text, selectedText, amud, ref, parentRef, id}) => {
      return this.updateDocument(this.postCommentRequests(text, selectedText, amud, ref, parentRef))
        .finally(() => this.refreshDatabaseDocument())
        .then(response => {
          this.unsavedCommentStore.markCommentSaved(id);
          return Promise.resolve(response);
        });
    },
    createError: ({ref, isRetry}) => (isRetry ? undefined : `Could not save comment on ${ref}`),
  });

  // TODO(drive): tests, and dependency injection?
  findInsertLocation(parentRef) {
    const {namedRanges} = this.databaseDocument;
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

  documentEnd() {
    const {content} = this.databaseDocument.body;
    return content[content.length - 1].endIndex - 1;
  }

  commentsForRef(ref) {
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

  computeCommentsForRef(ref) {
    if (!(ref in this.rangesByRef)) {
      return undefined;
    }
    const ranges = this.rangesByRef[ref];
    const documentBodyElements = this.documentBodyElements();
    return {
      comments: ranges.map((range, index) => {
        const documentText = extractDocumentText(range, documentBodyElements);
        const text = documentText.map(x => x.text);
        if (range.joined && text.length > 1) {
          const first = text.shift();
          const second = text.shift();
          text.unshift([first, second].join(" - "));
        }
        const hebrew = documentText.map(x => x.languageStats.hebrew).reduce((x, y) => x + y);
        const english = documentText.map(x => x.languageStats.english).reduce((x, y) => x + y);
        return {
          en: english > hebrew ? text : "",
          he: hebrew >= english ? text : "",
          ref: `${ref}-personal${index}`,
        };
      }),
    };
  }

  _documentBodyElements(contents, elements) {
    contents.content.forEach((content, index) => {
      if (content.paragraph) {
        if (index === 0) {
          const firstElement = content.paragraph.elements[0];
          const initialLength = firstElement.textRun.content.length;
          firstElement.textRun.content = firstElement.textRun.content.trimStart();
          firstElement.startIndex += initialLength - firstElement.textRun.content.length;
        }
        if ((index + 1) === contents.content.length) {
          const lastElement = content.paragraph.elements.slice(-1)[0];
          const initialLength = lastElement.textRun.content.length;
          lastElement.textRun.content = lastElement.textRun.content.trimEnd();
          lastElement.endIndex -= initialLength - lastElement.textRun.content.length;
        }
        elements.push(...content.paragraph.elements);
      } else if (content.table) {
        const cells = content.table.tableRows.flatMap(x => x.tableCells);
        cells.forEach(x => this._documentBodyElements(x, elements));
      }
    });
    return elements;
  }

  documentBodyElements() {
    return this._documentBodyElements(this.databaseDocument.body, []);
  }

  signIn() {
    localStorage.hasSignedInWithGoogle = "true";
    this.gapi.signIn();
  }

  signOut() {
    this.gapi.signOut();
  }

  updateDocument(requests) {
    if (!Array.isArray(requests)) {
      requests = [requests];
    }
    return this.gapi.batchUpdate({
      requests,
      documentId: this.databaseDocument.documentId,
      writeControl: {requiredRevisionId: this.databaseDocument.revisionId},
    });
  }

  triggerErrorListener() {
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
