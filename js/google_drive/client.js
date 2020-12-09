/* global gapi, gtag */
import {amudMetadata} from "../amud.ts";
import {rgbColor} from "./color.ts";
import {refSorter} from "./ref_sorter.ts";
import {extractDocumentText} from "./document_text.ts";
import {GatedExecutor} from "../gated_executor.ts";
import {insertFormattedTextRequests, insertTextWithUrls} from "./insertTextRequests.ts";
import {asPromise} from "../promises.ts";
import {RetryMethodFactory} from "../retry.ts";
import {insertSingleCellTableRequests} from "./tableRequests.ts";
import {checkNotUndefined} from "../undefined.ts";

const INSTRUCTIONS_TABLE_RANGE_NAME = "Instructions Table";

// The discoveryDoc is seemingly "loaded into" the gapi.client JS object
const APIS = [
  {
    discoveryDoc: "https://docs.googleapis.com/$discovery/rest?version=v1",
    apiScope: "https://www.googleapis.com/auth/documents",
  },
  {
    discoveryDoc: "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
    apiScope: "https://www.googleapis.com/auth/drive",
  },
];

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
  constructor(clientId, apiKey, unsavedCommentStore) {
    this.clientId = clientId;
    this.apiKey = apiKey;
    this.whenDatabaseReady = new GatedExecutor();
    this.resetState();

    this.isDebug = window.location.hostname === "localhost";
    const databaseType = this.isDebug ? "debug database" : "database";
    this.masechet = amudMetadata().masechet;
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
    retryingCall: () => {
      if (!gapi) {
        return Promise.reject();
      }

      return gapi.client.init({
        apiKey: this.apiKey,
        clientId: this.clientId,
        discoveryDocs: APIS.map(api => api.discoveryDoc),
        scope: APIS.map(api => api.apiScope).join(" "),
      });
    },
    then: () => {
      // Set the initial sign-in state.
      this.updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());

      gapi.auth2.getAuthInstance().isSignedIn.listen(isSignedIn => {
        this.updateSigninStatus(isSignedIn);
      });
    },
    createError: () => "Error initializing drive database",
  });

  updateSigninStatus(isSignedIn) {
    this.isSignedIn = isSignedIn;
    if (isSignedIn) {
      gtag("config", "GA_MEASUREMENT_ID", {
        user_id: gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getEmail(),
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
      return gapi.client.drive.files.update({
        fileId,
        appProperties: {
          "talmud.page.database": "true",
          "talmud.page.database.id": this.databaseProperty,
          "talmud.page.database.version": "1",
        },
      });
    },
    then: () => {},
    createError: () => "Error configuring database file (1y94r)",
  });

  findDocsDatabase = this.retryMethodFactory.retryingMethod({
    retryingCall: () => {
      return gapi.client.drive.files.list({
        q: `appProperties has { key='talmud.page.database.id' and value='${this.databaseProperty}' }`
          + " and trashed = false",
      });
    },
    then: response => {
      const {files} = response.result;
      if (files.length === 0) {
        this.databaseDocumentShouldBeCreated = true;
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
      return gapi.client.docs.documents.create({title});
    },
    then: response => {
      this.setDatabaseFileProperties(response.result.documentId);
      return this.getDatabaseDocument(response.result.documentId)
        .then(() => this.addInstructionsTable())
        .then(() => this.whenDatabaseReady.declareReady());
    },
    createError: () => "Error creating database file",
  });

  instructionsTableRequests() {
    // TODO: consider computing these values. That may require making multiple batch edits. For now,
    // it seems safe, but it would be good to be more resilient
    const TABLE_START = 1;
    const TABLE_TEXT_START = 5;

    return insertSingleCellTableRequests({
      tableStart: TABLE_START,
      borderColor: rgbColor(184, 145, 48),
      backgroundColor: rgbColor(251, 229, 163),
    }).concat(insertTextWithUrls([
      "This document was created with ",
      {text: "talmud.page", url: "https://talmud.page"},
      " and is used as a database for personalized comments that you create.",
      "\n\n",
      "Before making any edits, it's recommended to read ",
      {text: "these instructions", url: "https://talmud.page/caveats/google-docs"},
      ".",
    ], TABLE_TEXT_START));
  }

  addInstructionsTable = this.retryMethodFactory.retryingMethod({
    retryingCall: () => this.updateDocument(this.instructionsTableRequests()),
    then: () => this.refreshDatabaseDocument()
      .then(() => this.setInstructionsTableRange()),
    createError: () => "Error configuring database file (28zd3)",
  });

  setInstructionsTableRange = this.retryMethodFactory.retryingMethod({
    retryingCall: () => {
      let range;
      for (const section of this.databaseDocument.body.content) {
        if (section.table) {
          range = {startIndex: section.startIndex, endIndex: section.endIndex};
          break;
        }
      }
      if (!range) {
        throw new Error("Couldn't find instructions table!");
      }

      return this.updateDocument(createNamedRange(INSTRUCTIONS_TABLE_RANGE_NAME, range));
    },
    then: () => this.refreshDatabaseDocument(),
    createError: () => "Error configuring database file (0h7f1)",
  });

  getDatabaseDocument = this.retryMethodFactory.retryingMethod({
    retryingCall: (documentId) => {
      this.commentsByRef = {};
      return gapi.client.docs.documents.get({documentId});
    },
    then: response => {
      this.databaseDocument = response.result;
      if (!this.databaseDocument.namedRanges) {
        this.databaseDocument.namedRanges = {};
      }
      if (this.databaseUpdatedListener) this.databaseUpdatedListener();
    },
    createError: () => "Could not find database file",
  });

  refreshDatabaseDocument = () => this.getDatabaseDocument(this.databaseDocument.documentId);

  // TODO(drive): break up this method, possibly by extracting a state object.
  postCommentRequests(text, amud, ref, parentRef) {
    let insertLocation = this.findInsertLocation(parentRef);
    const requests = [];

    const headerRangeLabel = `header:${amud}`;
    const headerExists = headerRangeLabel in this.databaseDocument.namedRanges;
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

    if (headerExists && !text.startsWith("\n")) {
      text = "\n" + text;
    }
    if (!text.endsWith("\n")) {
      text += "\n";
    }

    const commentRange = {
      startIndex: insertLocation,
      endIndex: insertLocation + text.length,
    };
    requests.push(
      ...insertFormattedTextRequests(text, commentRange, "NORMAL_TEXT"),
      // Two equivalent named ranges are added. The "ref:"-prefixed range allows for indexing of
      // comments/notes by ref, so that when a text is linked from multiple locations (e.g. for
      // pesukim referenced throughout a masechet), the notes can be easily accessed from all
      // locations. The "parentRef:"-prefixed range helps maintain a readable ordering within the
      // Google Doc. For example, if a comment is added on Pasuk P1 that is referenced in Daf 2a,
      // a note will be added at the end of the Daf 2a section in the Google Doc, since that is
      // where the text was viewed when the note was recorded.
      // Note that if we create multiple docs, one for each titled text, then comments won't be
      // maintained across those titles.
      createNamedRange(`ref:${ref}`, commentRange),
      createNamedRange(`parentRef:${parentRef}`, commentRange),
    );
    return requests;
  }

  // These parameters should be kept in sync with addUnsavedComment() with the exception of `id`.
  postComment({text, amud, ref, parentRef, id}) {
    if (this.databaseDocumentShouldBeCreated) {
      this.createDocsDatabase();
    }

    const isRetry = id !== undefined;
    if (!isRetry) {
      id = this.unsavedCommentStore.addUnsavedComment({text, amud, ref, parentRef});
      gtag("event", "add_personal_note", {amud, ref, parentRef});
    }

    this.whenDatabaseReady.execute(
      () => this._postComment({text, amud, ref, parentRef, id, isRetry}));
  }

  _postComment = this.retryMethodFactory.retryingMethod({
    retryingCall: ({text, amud, ref, parentRef, id}) => {
      return this.updateDocument(this.postCommentRequests(text, amud, ref, parentRef))
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
    const prefixedRef = `ref:${ref}`;
    if (!(prefixedRef in this.databaseDocument.namedRanges)) {
      return undefined;
    }
    const ranges = this.databaseDocument.namedRanges[prefixedRef].namedRanges
          .flatMap(x => x.ranges);
    ranges.sort(rangeSorter);

    const documentBodyElements = this.documentBodyElements();
    return {
      comments: ranges.map((range, index) => {
        const documentText = extractDocumentText(
          range.startIndex, range.endIndex, documentBodyElements);
        const text = documentText.map(x => x.text);
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

  documentBodyElements() {
    // TODO: to be more resilient, this should do a complete traversal and get all textRuns that
    // could be nested inside other structures. See
    // https://developers.google.com/docs/api/samples/extract-text
    return this.databaseDocument.body.content
      .filter(x => x.paragraph)
      .flatMap(x => x.paragraph.elements);
  }

  signIn() {
    localStorage.hasSignedInWithGoogle = "true";
    gapi.auth2.getAuthInstance().signIn();
  }

  signOut() {
    gapi.auth2.getAuthInstance().signOut();
  }

  updateDocument(requests) {
    if (!Array.isArray(requests)) {
      requests = [requests];
    }
    return asPromise(
      gapi.client.docs.documents.batchUpdate({
        requests,
        documentId: this.databaseDocument.documentId,
        writeControl: {requiredRevisionId: this.databaseDocument.revisionId},
      }));
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
