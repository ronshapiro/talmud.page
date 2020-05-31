import gapi from "./google_apis.js";

// The discoveryDoc is seemingly "loaded into" the gapi.client JS object
const APIS = [
  {
    discoveryDoc: "https://docs.googleapis.com/$discovery/rest?version=v1",
    apiScope: "https://www.googleapis.com/auth/documents",
  },
  {
    discoveryDoc: "https://sheets.googleapis.com/$discovery/rest?version=v4",
    apiScope: "https://www.googleapis.com/auth/spreadsheets",
  },
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

class DriveClient {
  constructor(clientId, apiKey) {
    this.clientId = clientId;
    this.apiKey = apiKey;
    this.resetState();
  }

  resetState() {
    this.errors = [];
    this.spreadsheetDatabaseId = undefined;
  }

  /**
   *  Initializes the API client library and sets up sign-in state
   *  listeners.
   */
  init() {
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
      this.findOrCreateSpreadsheetDatabase();
    } else {
      this.resetState();
    }
    if (this.signInStatusListener) this.signInStatusListener();
  }

  findOrCreateSpreadsheetDatabase(retryDelay) {
    gapi.client.drive.files.list({
      q: "appProperties has { key='talmud.page' and value='database' }",
    }).then(response => {
      if (response.status === 200) {
        const files = response.result.files;
        if (files.length === 0) {
          this.createSpreadsheetDatabase();
        } else if (files.length === 1) {
          this.saveSpreadsheetDatabaseId(files[0].id);
        } else {
          this.errors.push("Too many spreadsheets"); // TODO(drive): handle in the UI
        }
      } else {
        retryDelay = exponentialBackoff(retryDelay);
        setTimeout(() => this.findOrCreateSpreadsheetDatabase(retryDelay), retryDelay);
      }
    });
  }

  createSpreadsheetDatabase(retryDelay) {
    gapi.client.sheets.spreadsheets.create({
      properties: {
        title: "talmud.page database"
      }
    }).then(response => {
      if (response.status === 200) {
        this.setSpreadsheetDatabaseProperties(response.result.spreadsheetId);
      } else {
        setTimeout(() => this.createSpreadsheetDatabase(retryDelay), retryDelay);
      }
    });
  }

  setSpreadsheetDatabaseProperties(spreadsheetId, retryDelay) {
    checkNotUndefined(spreadsheetId, "spreadsheetId");
    gapi.client.drive.files.update({
      fileId: spreadsheetId,
      appProperties: {
        "talmud.page": "database",
      },
    }).then(response => {
      if (response.status === 200) {
        this.saveSpreadsheetDatabaseId(spreadsheetId);
      } else {
        retryDelay = exponentialBackoff(retryDelay);
        setTimeout(() => {
          this.setSpreadsheetDatabaseProperties(spreadsheetId, retryDelay);
        }, retryDelay);
      }
    });
  }

  saveSpreadsheetDatabaseId(id) {
    checkNotUndefined(id, "id");
    this.spreadsheetDatabaseId = id;
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

function handleGoogleClientLoad() {
  gapi.load('client:auth2', () => driveClient.init());
}

module.exports = {
  handleGoogleClientLoad: handleGoogleClientLoad,
  driveClient: driveClient,
}

// TODO(drive): remove
window.driveClient = driveClient;
