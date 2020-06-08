import {amudMetadata} from "./amud.js";
import {refSorter} from "./ref_sorter.js";
import {filterDocumentRange} from "./filter_document_range.js";
import {newOnReady} from "./once_document_ready.js";

const HEBREW_LETTERS = /[א-ת]/g;
const LATIN_LETTERS = /[a-zA-Z]/g;
const INSTRUCTIONS_TABLE_RANGE_NAME = "Instructions Table";

// The discoveryDoc is seemingly "loaded into" the gapi.client JS object
const APIS = [
  {
    discoveryDoc: "https://docs.googleapis.com/$discovery/rest?version=v1",
    apiScope: "https://www.googleapis.com/auth/documents",
  },
  /*{
    discoveryDoc: "https://sheets.googleapis.com/$discovery/rest?version=v4",
    apiScope: "https://www.googleapis.com/auth/spreadsheets",
  },*/
  {
    discoveryDoc: "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
    apiScope: "https://www.googleapis.com/auth/drive.readonly",
  },
];

const checkNotUndefined = function(value, string) {
  if (value === undefined) {
    throw "undefined " + string;
  }
}

const exponentialBackoff = (retryDelay) => retryDelay ? retryDelay * 1.5 : 200;

const rgbColor = (red, green, blue) => {
  return {
    color: {
      rgbColor: {
        red: red/256,
        green: green/256,
        blue: blue/256,
      },
    }
  };
}

const insertFormattedTextRequests = (text, range, style) => {
  return [{
    insertText: {
      text: text,
      location: {index: range.startIndex}
    },
  },{
    updateParagraphStyle: {
      paragraphStyle: {namedStyleType: style},
      fields: "*",
      range: range,
    },
  }];
}

class DriveClient {
  constructor(clientId, apiKey) {
    this.clientId = clientId;
    this.apiKey = apiKey;
    this.whenDatabaseReady = newOnReady();
    this.resetState();

    this.isDebug = location.hostname === "localhost";
    const databaseType = this.isDebug ? "debug database" : "database";
    this.masechet = amudMetadata().masechet;
    this.databaseProperty = `${this.masechet} ${databaseType}`;
    if (this.isDebug) {
      this.whenDatabaseReady.execute(() => console.log("Debug database document ready!"));
    }
  }

  resetState() {
    this.errors = [];
    this.whenDatabaseReady.reset();
    this.commentsByRef = undefined;
  }

  /**
   *  Initializes the API client library and sets up sign-in state
   *  listeners.
   */
  init() {
    if (!gapi) {
      setTimeout(() => this.init(), 100);
      return;
    }

    gapi.client.init({
      apiKey: this.apiKey,
      clientId: this.clientId,
      discoveryDocs: APIS.map(api => api.discoveryDoc),
      scope: APIS.map(api => api.apiScope).join(" "),
    }).then(() => {
      // Set the initial sign-in state.
      this.updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());

      gapi.auth2.getAuthInstance().isSignedIn.listen(isSignedIn => {
        this.updateSigninStatus(isSignedIn);
      });
    });
  }

  updateSigninStatus(isSignedIn) {
    this.isSignedIn = isSignedIn;
    if (isSignedIn) {
      gtag("config", "GA_MEASUREMENT_ID", {
        "user_id": gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getEmail(),
      });
      this.findDocsDatabase();
    } else {
      this.resetState();
    }
    if (this.signInStatusListener) this.signInStatusListener();
  }

  setDatabaseFileProperties(fileId, retryDelay) {
    checkNotUndefined(fileId, "fileId");
    gapi.client.drive.files.update({
      fileId: fileId,
      appProperties: {
        "talmud.page.database": "true",
        "talmud.page.database.id": this.databaseProperty,
        "talmud.page.database.version": "1",
      },
    }).then(response => {
      if (response.status !== 200) {
        retryDelay = exponentialBackoff(retryDelay);
        setTimeout(() => {
          this.setDatabaseFileProperties(fileId, onSuccess, retryDelay);
        }, retryDelay);
      }
    });
  }

  findDocsDatabase(retryDelay) {
    gapi.client.drive.files.list({
      q: `appProperties has { key='talmud.page.database.id' and value='${this.databaseProperty}' }`
        + ` and trashed = false`,
    }).then(response => {
      if (response.status === 200) {
        const files = response.result.files;
        if (files.length === 0) {
          this.databaseDocumentShouldBeCreated = true;
        } else if (files.length === 1) {
          this.getDatabaseDocument(files[0].id, () => this.whenDatabaseReady.declareReady());
        } else {
          this.errors.push("Too many docs"); // TODO(drive): handle in the UI
        }
      } else {
        retryDelay = exponentialBackoff(retryDelay);
        setTimeout(() => this.findDocsDatabase(retryDelay), retryDelay);
      }
    });
  }

  createDocsDatabase(retryDelay) {
    this.databaseDocumentShouldBeCreated = false;
    // TODO: localize this
    const title = this.isDebug
          ? `talmud.page ${this.masechet} debug notes`
          : `talmud.page ${this.masechet} notes`;
    gapi.client.docs.documents.create({
      title: title,
    }).then(response => {
      if (response.status === 200) {
        this.setDatabaseFileProperties(response.result.documentId);
        this.getDatabaseDocument(response.result.documentId, () => {
          this.addInstructionsTable(() => this.whenDatabaseReady.declareReady());
        });
      } else {
        retryDelay = exponentialBackoff(retryDelay);
        setTimeout(() => this.createDocsDatabase(retryDelay), retryDelay);
      }
    });
  }

  instructionsTableRequests() {
    const caveatsUrl = "https://talmud.page/caveats/google-docs";
    const caveatsText = "these instructions";
    const text = "This document was created with talmud.page and is used as a database for"
          + " personalized comments that you create.\n\nBefore making any edits, it's recommended"
          + ` to read ${caveatsText}.`;
    // TODO: consider computing these values. That may require making multiple batch edits. For now,
    // it seems safe, but it would be good to be more resilient
    const TABLE_START = 2;
    const TABLE_TEXT_START = 5;
    const borderStyle = {
      color: rgbColor(184, 145, 48),
      width: {
        magnitude: 1,
        unit: "PT",
      },
      dashStyle: "SOLID",
    };
    const requests = [
      {
        insertTable: {
          rows: 1,
          columns: 1,
          endOfSegmentLocation: {},
        },
      }, {
        updateTableCellStyle: {
          tableStartLocation: {index: TABLE_START},
          fields: "*",
          tableCellStyle: {
            backgroundColor: rgbColor(251, 229, 163),
            borderLeft: borderStyle,
            borderRight: borderStyle,
            borderTop: borderStyle,
            borderBottom: borderStyle,
          },
        },
      }, {
        insertText: {
          text: text,
          location: {index: TABLE_TEXT_START}
        }
      },
    ];

    const addLink = (url, start, end) => {
      return {
        updateTextStyle: {
          textStyle: {
            link: {url: url},
            underline: true,
            foregroundColor: rgbColor(44, 91, 198),
          },
          fields: "*",
          range: {
            startIndex: TABLE_TEXT_START + start,
            endIndex: TABLE_TEXT_START + end,
          },
        },
      };
    };

    let talmudPageIndex = -1;
    while (true) {
      // leading space helps to ignore caveatsUrl
      talmudPageIndex = text.indexOf(" talmud.page", talmudPageIndex);
      if (talmudPageIndex === -1) {
        break;
      }
      talmudPageIndex++;

      requests.push(
        addLink("https://talmud.page", talmudPageIndex, talmudPageIndex + "talmud.page".length));
    }

    requests.push(
      addLink(caveatsUrl,
              text.lastIndexOf(caveatsText),
              text.lastIndexOf(caveatsText) + caveatsText.length));

    return requests;
  }

  addInstructionsTable(andThen, retryDelay) {
    gapi.client.docs.documents.batchUpdate({
      documentId: this.databaseDocument.documentId,
      requests: this.instructionsTableRequests(),
      writeControl: {requiredRevisionId: this.databaseDocument.revisionId},
    }).then(response => {
      this.getDatabaseDocument(this.databaseDocument.documentId, () => {
        this.setInstructionsTableRange(andThen);
      });
    }).catch(response => {
      retryDelay = exponentialBackoff(retryDelay);
      setTimeout(() => {
        this.getDatabaseDocument(this.databaseDocument.documentId, () => {
          this.addInstructionsTable(andThen, retryDelay);
        })
      }, retryDelay);
    });
  }

  setInstructionsTableRange(andThen, retryDelay) {
    let range;
    for (const section of this.databaseDocument.body.content) {
      if (section.table) {
        range = {startIndex: section.startIndex, endIndex: section.endIndex};
        break;
      }
    }
    if (!range) {
      throw "Couldn't find instructions table!";
    }
    gapi.client.docs.documents.batchUpdate({
      documentId: this.databaseDocument.documentId,
      requests: [{
        createNamedRange: {
          name: INSTRUCTIONS_TABLE_RANGE_NAME,
          range: range,
        },
      }],
      writeControl: {requiredRevisionId: this.databaseDocument.revisionId},
    }).then(response => {
      this.getDatabaseDocument(this.databaseDocument.documentId, andThen);
    }).catch(response => {
      retryDelay = exponentialBackoff(retryDelay);
      setTimeout(() => {
        this.getDatabaseDocument(this.databaseDocument.documentId, () => {
          this.setInstructionsTableRange(andThen, retryDelay);
        });
      }, retryDelay);
    });
  }

  getDatabaseDocument(documentId, andThen) {
    this.commentsByRef = {};
    gapi.client.docs.documents.get({documentId: documentId})
      .then(response => {
        this.databaseDocument = response.result;
        if (!this.databaseDocument.namedRanges) {
          this.databaseDocument.namedRanges = {};
        }
        if (andThen) andThen();
        if (this.databaseUpdatedListener) this.databaseUpdatedListener();
      });
  }

  appendNamedRange(text, amud, ref, parentRef) {
    if (this.databaseDocumentShouldBeCreated) {
      this.createDocsDatabase();
    }
    gtag("event", "add_personal_note", {
      amud: amud,
      ref: ref,
      parentRef: parentRef,
    });
    this.whenDatabaseReady.execute(() => this._appendNamedRange(text, amud, ref, parentRef));
  }

  // TODO(drive): break up this method, possibly by extracting a state object. Also consider
  // extracting a method just for the requests
  _appendNamedRange(text, amud, ref, parentRef, retryDelay) {
    let insertLocation = this.findInsertLocation(ref, parentRef);
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
        {
          createNamedRange: {
            name: headerRangeLabel,
            range: headerRange,
          },
        });
      insertLocation += headerText.length;
    }

    if (headerExists && !text.startsWith("\n")) {
      text = "\n" + text;
    }
    if (!text.endsWith("\n")) {
      text = text + "\n";
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
      {
        createNamedRange: {
          name: `ref:${ref}`,
          range: commentRange,
        }
      },
      {
        createNamedRange: {
          name: `parentRef:${parentRef}`,
          range: commentRange,
        }
      }
    );

    gapi.client.docs.documents.batchUpdate({
      documentId: this.databaseDocument.documentId,
      requests: requests,
      writeControl: {requiredRevisionId: this.databaseDocument.revisionId},
    }).then(response => {
      this.getDatabaseDocument(this.databaseDocument.documentId);
    }).catch(response => {
      retryDelay = exponentialBackoff(retryDelay);
      setTimeout(() => {
        this.getDatabaseDocument(this.databaseDocument.documentId, () => {
          this._appendNamedRange(text, amud, ref, parentRef, retryDelay);
        })
      }, retryDelay);
      // TODO(drive:must): update all other promises to use .catch()
    });
  }

  // TODO(drive): tests, and dependency injection?
  findInsertLocation(ref) {
    const {namedRanges} = this.databaseDocument;
    if (Object.keys(namedRanges).length === 0) {
      return this.documentEnd();
    }

    const prefixedRef = `ref:${ref}`;
    if (prefixedRef in namedRanges) {
      let lastRange;
      for (const namedRange of namedRanges[prefixedRef].namedRanges) {
        for (const range of namedRange.ranges) {
          if (!lastRange || range.endIndex > lastRange.endIndex) {
            lastRange = range;
          }
        }
      }
      return lastRange.endIndex;
    }

    const parentRefs = Object.keys(namedRanges)
          .filter(ref => ref.startsWith("parentRef:"))
          .map(ref => ref.substring("parentRef:".length));
    parentRefs.push(ref);
    parentRefs.sort(refSorter);
    const index = parentRefs.indexOf(ref);
    if (index !== 0) {
      return this.findInsertLocation(parentRefs[index -1]);
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
    const content = this.databaseDocument.body.content;
    return content[content.length - 1].endIndex - 1;
  }

  commentsForRef(ref) {
    if (!this.databaseDocument) {
      return;
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
      return;
    }
    const ranges = this.databaseDocument.namedRanges[prefixedRef].namedRanges
          .flatMap(x => x.ranges);
    ranges.sort((first, second) => {
      if (first.startIndex < second.startIndex) {
        return -1;
      } else if (first.startIndex == second.startIndex) {
        return first.endIndex - second.endIndex;
      } else {
        return 1;
      }
    });

    return {comments: ranges.map(range => {
      const text = this.documentText(range.startIndex, range.endIndex);
      const allText = text.join("");
      const hebrew = allText.match(HEBREW_LETTERS) || [];
      const english = allText.match(LATIN_LETTERS) || [];
      return {
        en: english.length > hebrew.length ? text : "",
        he: hebrew.length >= english.length ? text : "",
      };
    })};
  }

  documentText(start, end) {
    return filterDocumentRange(
      start,
      end,
      // TODO: to be more resilient, this should do a complete traversal and get all textRuns that
      // could be nested inside other structures. See
      // https://developers.google.com/docs/api/samples/extract-text
      this.databaseDocument.body.content
        .filter(x => x.paragraph)
        .flatMap(x => x.paragraph.elements));
  }

  documentBodyElements() {
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
}

const driveClient = new DriveClient(
  '709056533343-uei1uvpotrhfqg2nttbckhbcjunms8uu.apps.googleusercontent.com', // client id
  'AIzaSyCVV8_I0SrTxXrOeCR51GYtb8cJSX62I_Q', // api key
);

window.handleGoogleClientLoad = () => {
  if (location.hostname !== "localhost") return; // TODO(drive:must): remove
  gapi.load('client:auth2', () => driveClient.init());
}

module.exports = {
  driveClient: driveClient,
}

window.driveClient = driveClient; // TODO(drive:must): remove
