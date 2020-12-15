/* global gapi */
// @ts-ignore
import {asPromise} from "../promises.ts";

export abstract class GoogleApiClient {
  abstract init(): Promise<any>;
  abstract isSignedIn(): boolean;
  abstract signIn(): void;
  abstract signOut(): void;
  abstract registerSignInListener(listener: (isSignedIn: boolean) => void): void;
  abstract getSignedInUserEmail(): string;
  abstract searchFiles(databaseProperty: string): gapi.client.Request<gapi.client.drive.FileList>;
  abstract createDocument(title: string): gapi.client.Request<gapi.client.docs.Document>;
  abstract setDatabaseFileProperties(
    fileId: string,
    databaseProperty: string,
  ): gapi.client.Request<gapi.client.drive.File>;

  abstract getDatabaseDocument(documentId: string): Promise<gapi.client.docs.Document>;
  abstract batchUpdate(params: BatchUpdateParams): Promise<any>;
}

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

interface BatchUpdateParams {
  requests: gapi.client.docs.Request[];
  documentId: string;
  writeControl: gapi.client.docs.WriteControl;
}

export class RealGoogleApiClient extends GoogleApiClient {
  apiKey: string;
  clientId: string;

  constructor(apiKey: string, clientId: string) {
    super();
    this.apiKey = apiKey;
    this.clientId = clientId;
  }

  init(): Promise<any> {
    if (!gapi) {
      return Promise.reject();
    }

    return gapi.client.init({
      apiKey: this.apiKey,
      clientId: this.clientId,
      discoveryDocs: APIS.map(api => api.discoveryDoc),
      scope: APIS.map(api => api.apiScope).join(" "),
    });
  }

  isSignedIn(): boolean {
    return gapi.auth2.getAuthInstance().isSignedIn.get();
  }

  signIn(): void {
    gapi.auth2.getAuthInstance().signIn();
  }

  signOut(): void {
    gapi.auth2.getAuthInstance().signOut();
  }

  registerSignInListener(listener: (isSignedIn: boolean) => void): void {
    gapi.auth2.getAuthInstance().isSignedIn.listen(listener);
  }

  getSignedInUserEmail(): string {
    return gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile().getEmail();
  }

  searchFiles(databaseProperty: string): gapi.client.Request<gapi.client.drive.FileList> {
    return gapi.client.drive.files.list({
      q: `appProperties has { key='talmud.page.database.id' and value='${databaseProperty}' }`
        + " and trashed = false",
    });
  }

  createDocument(title: string): gapi.client.Request<gapi.client.docs.Document> {
    // @ts-ignore for whatever reason, there's no title argument here in the type spec
    return gapi.client.docs.documents.create({title});
  }

  setDatabaseFileProperties(
    fileId: string,
    databaseProperty: string,
  ): gapi.client.Request<gapi.client.drive.File> {
    return gapi.client.drive.files.update({
      fileId,
      // @ts-ignore
      appProperties: {
        "talmud.page.database": "true",
        "talmud.page.database.id": databaseProperty,
        "talmud.page.database.version": "1",
      },
    });
  }

  getDatabaseDocument(documentId: string): Promise<gapi.client.docs.Document> {
    return asPromise(gapi.client.docs.documents.get({documentId}))
      // @ts-ignore
      .then(x => x.result);
  }

  batchUpdate(params: BatchUpdateParams): Promise<any> {
    return asPromise(
      gapi.client.docs.documents.batchUpdate(
        // @ts-ignore
        params));
  }
}
