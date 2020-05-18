// The discoveryDoc is seemingly "loaded into" the gapi.client JS object
const _APIS = [
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
    throw "undefined " + value;
  }
}

class DriveClient {
  constructor(clientId, apiKey) {
    this.clientId = clientId;
    this.apiKey = apiKey;
    this.resetState();
  }

  resetState() {
    this.errors = [];
    this.stateListeners = [];
    this.spreadsheetDatabaseId = undefined;
  }

  addListener(fn) {
    this.stateListeners.push(fn);
  }

  removeListener(fn) {
    this.stateListeners = this.stateListeners.filter(x => x != fn);
  }

  invokeListeners() {
    this.stateListeners.forEach(fn => fn());
  }

  /**
   *  Initializes the API client library and sets up sign-in state
   *  listeners.
   */
  init() {
    gapi.client.init({
      apiKey: this.apiKey,
      clientId: this.clientId,
      discoveryDocs: _APIS.map(api => api.discoveryDoc),
      scope: _APIS.map(api => api.apiScope).join(" "),
    }).then(() => {
      // Handle the initial sign-in state.
      if (gapi.auth2.getAuthInstance().isSignedIn.get()) {
        this.updateSigninStatus(true);
      }

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
    this.invokeListeners();
  }

  findOrCreateSpreadsheetDatabase() {
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
          this.errors.push("Too many spreadsheets");
        }
      }
    });
  }

  createSpreadsheetDatabase() {
    gapi.client.sheets.spreadsheets.create({
      properties: {
        title: "talmud.page database"
      }
    }).then(response => {
      this.setSpreadsheetDatabaseProperties(response.result.spreadsheetId);
    });
  }

  setSpreadsheetDatabaseProperties(spreadsheetId) {
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
        console.log(response);
        // do not submit: exponential retry
      }
    });
  }

  saveSpreadsheetDatabaseId(id) {
    checkNotUndefined(id, "id");
    this.spreadsheetDatabaseId = id;
    this.invokeListeners();
    console.log(id);
  }

  signIn() {
    localStorage.hasSignedInWithGoogle = "true";
    gapi.auth2.getAuthInstance().signIn();
  }

  signOut() {
    gapi.auth2.getAuthInstance().signOut();
  }
}


// do not submit: make sure to check all response codes

const driveClient = new DriveClient(
  '709056533343-uei1uvpotrhfqg2nttbckhbcjunms8uu.apps.googleusercontent.com', // client id
  'AIzaSyCVV8_I0SrTxXrOeCR51GYtb8cJSX62I_Q', // api key
);

function handleGoogleClientLoad() {
  gapi.load('client:auth2', () => driveClient.init());
}
