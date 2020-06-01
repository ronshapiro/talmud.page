import {refSorter} from "./ref_sorter.js";
import {filterDocumentRange} from "./filter_document_range.js";

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

const DRIVE_FILE_DATABASE_TYPE = location.hostname === "localhost" ? "debug database" : "database";

const checkNotUndefined = function(value, string) {
  if (value === undefined) {
    throw "undefined " + string;
  }
}

const exponentialBackoff = (retryDelay) => retryDelay ? retryDelay * 1.5 : 200;

class DriveClient {
  constructor(clientId, apiKey) {
    this.clientId = clientId;
    this.apiKey = apiKey;
    this.resetState();
  }

  resetState() {
    this.errors = [];
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
      this.findOrCreateDocsDatabase();
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
        "talmud.page": DRIVE_FILE_DATABASE_TYPE,
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

  findOrCreateDocsDatabase(retryDelay) {
    gapi.client.drive.files.list({
      q: `appProperties has { key='talmud.page' and value='${DRIVE_FILE_DATABASE_TYPE}' }`
        + ` and trashed = false`,
    }).then(response => {
      if (response.status === 200) {
        const files = response.result.files;
        if (files.length === 0) {
          this.createDocsDatabase();
        } else if (files.length === 1) {
          this.getDatabaseDocument(files[0].id, () => console.log("Database document ready!"));
        } else {
          this.errors.push("Too many docs"); // TODO(drive): handle in the UI
        }
      } else {
        retryDelay = exponentialBackoff(retryDelay);
        setTimeout(() => this.findOrCreateDocsDatabase(retryDelay), retryDelay);
      }
    });
  }

  createDocsDatabase(retryDelay) {
    gapi.client.docs.documents.create({
      title: `talmud.page ${DRIVE_FILE_DATABASE_TYPE}`
    }).then(response => {
      if (response.status === 200) {
        this.setDatabaseFileProperties(response.result.documentId);
        this.getDatabaseDocument(response.result.documentId);
      } else {
        retryDelay = exponentialBackoff(retryDelay);
        setTimeout(() => this.createDocsDatabase(retryDelay), retryDelay);
      }
    });
  }

  // TODO(drive): when this is synced, redraw UI in case comments have changed
  getDatabaseDocument(documentId, andThen) {
    gapi.client.docs.documents.get({documentId: documentId})
      .then(response => {
        this.databaseDocument = response.result;
        if (!this.databaseDocument.namedRanges) {
          this.databaseDocument.namedRanges = {};
        }
        if (andThen) andThen();
      });
  }

  // TODO(drive): break up this method, possibly by extracting a state object
  appendNamedRange(text, amud, ref, parentRef, retryDelay) {
    let insertLocation = this.findInsertLocation(ref, parentRef);
    const requests = [];

    const headerRangeLabel = `header:${amud}`;
    const headerExists = headerRangeLabel in this.databaseDocument.namedRanges;
    if (!headerExists) {
      const headerText = amud + "\n";
      const headerRange = {
        startIndex: insertLocation,
        // TODO(drive): check UTF-16 length here
        endIndex: insertLocation + headerText.length,
      }
      requests.push(
        {
          insertText: {
            text: headerText,
            location: {index: insertLocation},
          }
        }, {
          updateParagraphStyle: {
            paragraphStyle: {namedStyleType: "HEADING_2"},
            fields: "*",
            range: headerRange,
          },
        }, {
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

    requests.push({
      insertText: {
        text: text,
        location: {index: insertLocation},
      }
    });
    const namedRangeRequest = name => {
      return {
        createNamedRange: {
          name: name,
          range: {
            startIndex: insertLocation,
            // TODO(drive): check UTF-16 length here
            endIndex: insertLocation + text.length,
          }
        },
      };
    };
    requests.push(
      // Two equivalent named ranges are added. The "ref:"-prefixed range allows for indexing of
      // comments/notes by ref, so that when a text is linked from multiple locations (e.g. for
      // pesukim referenced throughout a masechet), the notes can be easily accessed from all
      // locations. The "parentRef:"-prefixed range helps maintain a readable ordering within the
      // Google Doc. For example, if a comment is added on Pasuk P1 that is referenced in Daf 2a,
      // a note will be added at the end of the Daf 2a section in the Google Doc, since that is
      // where the text was viewed when the note was recorded.
      // Note that if we create multiple docs, one for each titled text, then comments won't be
      // maintained across those titles.
      namedRangeRequest(`ref:${ref}`),
      namedRangeRequest(`parentRef:${parentRef}`));

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
          this.appendNamedRange(text, amud, ref, parentRef, retryDelay);
        })
      }, retryDelay);
      // TODO(drive): update all other promises to use .catch()
    });
  }

  // TODO(drive): tests, and dependency injection?
  findInsertLocation(ref) {
    if (Object.keys(this.databaseDocument.namedRanges).length === 0) {
      return this.documentEnd();
    }

    const prefixedRef = `ref:${ref}`;
    if (prefixedRef in this.databaseDocument.namedRanges) {
      let lastRange;
      for (const namedRange of this.databaseDocument.namedRanges[prefixedRef].namedRanges) {
        for (const range of namedRange.ranges) {
          if (!lastRange || range.endIndex > lastRange.endIndex) {
            lastRange = range;
          }
        }
      }
      return lastRange.endIndex;
    }

    const parentRefs = Object.keys(this.databaseDocument.namedRanges)
          .filter(ref => ref.startsWith("parentRef:"))
          .map(ref => ref.substring("parentRef:".length));
    parentRefs.push(ref);
    parentRefs.sort(refSorter);
    const index = parentRefs.indexOf(ref);
    if (index === 0) {
      return this.startOfNotes();
    }
    return this.findInsertLocation(parentRefs[index -1]);
  }

  startOfNotes() {
    // TODO(drive): add a header with instructions, and then return the next line after that
    return 1;
  }

  documentEnd() {
    const content = this.databaseDocument.body.content;
    return content[content.length - 1].endIndex - 1;
  }

  commentsForRef(ref) {
    const prefixedRef = `ref:${ref}`;
    if (!(prefixedRef in this.databaseDocument.namedRanges)) {
      return [];
    }
    return this.databaseDocument.namedRanges[prefixedRef].namedRanges
      .flatMap(x => x.ranges)
      .map(range => this.documentText(range.startIndex, range.endIndex));
  }

  documentText(start, end) {
    return filterDocumentRange(
      start, end,
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
  if (location.hostname !== "localhost") return; // TODO(drive): remove
  gapi.load('client:auth2', () => driveClient.init());
}

module.exports = {
  driveClient: driveClient,
}

window.driveClient = driveClient; // TODO(drive): remove
