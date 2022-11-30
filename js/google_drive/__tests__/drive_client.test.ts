/* eslint-disable quote-props */
import {DriveClient} from "../client";
import {readUtf8} from "../../../files";
import {GoogleApiClient} from "../gapi";
import {UnsavedComment, UnsavedCommentStore} from "../types";

class RecordedApiClient extends GoogleApiClient {
  getDatabaseDocument(documentId: string): Promise<gapi.client.docs.Document> {
    return readUtf8(`js/google_drive/__tests__/${documentId}`).then(x => JSON.parse(x));
  }

  init(): Promise<any> {
    throw new Error("Unimplemented");
  }

  isSignedIn(): boolean {
    throw new Error("Unimplemented");
  }

  signIn(): void {
    throw new Error("Unimplemented");
  }

  signOut(): void {
    throw new Error("Unimplemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  registerSignInListener(listener: (isSignedIn: boolean) => void): void {
    throw new Error("Unimplemented");
  }

  getSignedInUserEmail(): string {
    throw new Error("Unimplemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createDocument(title: string): gapi.client.Request<gapi.client.docs.Document> {
    throw new Error("Unimplemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  searchFiles(databaseProperty: string): gapi.client.Request<gapi.client.drive.FileList> {
    throw new Error("Unimplemented");
  }

  setDatabaseFileProperties(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    fileId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    databaseProperty: string,
  ): gapi.client.Request<gapi.client.drive.File> {
    throw new Error("Unimplemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  batchUpdate(params: any): Promise<any> {
    throw new Error("Unimplemented");
  }
}

class FakeUnsavedCommentStore implements UnsavedCommentStore {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  init(client: any): void {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addUnsavedComment(comment: UnsavedComment): undefined {
    throw new Error("Unimplemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  markCommentSaved(id: string): any {
    throw new Error("Unimplemented");
  }
}

const client = new DriveClient(
  new RecordedApiClient(),
  new FakeUnsavedCommentStore(),
  "masechet name",
  true);

function expectEqualKeys(first: any, second: any) {
  expect(new Set(Object.keys(first))).toEqual(new Set(Object.keys(second)));
}

function expectCommentsToEqual(expectedComments: any) {
  expectEqualKeys(client.rangesByRef, expectedComments);
  for (const [ref, comments] of Object.entries(expectedComments)) {
    expect(comments).toEqual(client.commentsForRef(ref)!.comments);
  }
}

function expectHighlightsToEqual(expectedHighlights: any) {
  expectEqualKeys(client.highlightsByRef, expectedHighlights);
  for (const [ref, highlights] of Object.entries(expectedHighlights)) {
    expect(highlights).toEqual(client.highlightsForRef(ref));
  }
}

test("blank document", () => {
  return client.getDatabaseDocument("blank_document.json")
    .then(() => {
      expectCommentsToEqual({});
      expectHighlightsToEqual({});
      expect(client.databaseDocument.namedRanges).toEqual({});
    });
});

test("no comments", () => {
  return client.getDatabaseDocument("no_comments.json")
    .then(() => {
      expectCommentsToEqual({});
      expectHighlightsToEqual({});
      expect(client.databaseDocument.namedRanges).toHaveProperty("Instructions Table");
    });
});

test("just amud header", () => {
  return client.getDatabaseDocument("just_amud_header.json")
    .then(() => {
      expectCommentsToEqual({});
      expectHighlightsToEqual({});
      expect(client.databaseDocument.namedRanges).toHaveProperty("header:2a");
    });
});

test("Simple v2 comments", () => {
  return client.getDatabaseDocument("simple_v2_comments.json")
    .then(() => {
      expectHighlightsToEqual({});
      expectCommentsToEqual({
        "Exodus 11:7": [{
          "en": [
            '<span class="personal-comment-bold">that you may</span> - Comment on Pasuk on Rashi',
          ],
          "he": "",
          "id": "0513ae37-3fc6-4ef3-8254-5ce834805b40",
          "ref": "Exodus 11:7-personal0",
          "sourceRef": "Exodus 11:7",
          "sourceHeRef": "Exodus 11:7",
        }],
        "Pesachim 23a.7": [{
          "en": "",
          "he": ['<span class="personal-comment-bold">עוווווד עמוד</span> - Another amud'],
          "id": "16cf66aa-cab4-4e6b-95c6-1354ceac18bb",
          "ref": "Pesachim 23a.7-personal0",
          "sourceRef": "Pesachim 23a.7",
          "sourceHeRef": "Pesachim 23a.7",
        }],
        "Pesachim 22a.1": [
          {
            "en": "",
            "he": [
              '<span class="personal-comment-bold">תגובההה סטנדריטת</span> - Standard comment',
            ],
            "id": "723ff4af-6b40-4b3f-9594-b8a8203f6ff4",
            "ref": "Pesachim 22a.1-personal0",
            "sourceRef": "Pesachim 22a.1",
            "sourceHeRef": "Pesachim 22a.1",
          },
          {
            "en": "",
            "he": [
              '<span class="personal-comment-bold">תגובההה סטנדרתית 2</span> - Standard comment 2',
            ],
            "id": "3054875a-af39-4cd6-a193-de0d9e9d8a4b",
            "ref": "Pesachim 22a.1-personal1",
            "sourceRef": "Pesachim 22a.1",
            "sourceHeRef": "Pesachim 22a.1",
          },
          {
            "en": ['<span class="personal-comment-bold">יר? אוֹתוֹ</span> - Return to earlier ref'],
            "he": "",
            "id": "c74336ab-90f9-4178-bb2e-36ddf8f8bf18",
            "ref": "Pesachim 22a.1-personal2",
            "sourceRef": "Pesachim 22a.1",
            "sourceHeRef": "Pesachim 22a.1",
          },
        ],
        "Pesachim 22a.3": [{
          "en": "",
          "he": ['<span class="personal-comment-bold">גִּיד הַנָּשֶׁ</span> - הערה בערבית'],
          "id": "cebe9e65-d83a-44f9-99f3-359cd7a590b8",
          "ref": "Pesachim 22a.3-personal0",
          "sourceRef": "Pesachim 22a.3",
          "sourceHeRef": "Pesachim 22a.3",
        }],
        "Rashi on Pesachim 22a:1:1": [{
          "en": "",
          "he": [
            '<span class="personal-comment-bold">תגובה ברש״ייייייי</span> - Comment on Rashi',
          ],
          "id": "d7d29ce4-ffbe-4621-99b7-ed8916694799",
          "ref": "Rashi on Pesachim 22a:1:1-personal0",
          "sourceRef": "Rashi on Pesachim 22a:1:1",
          "sourceHeRef": "Rashi on Pesachim 22a:1:1",
        }],
      });
    });
});

test("v1 and v2 comments", () => {
  return client.getDatabaseDocument("v1_and_v2_comments.json")
    .then(() => {
      expectHighlightsToEqual({});
      expectCommentsToEqual({
        "Exodus 11:7": [
          {
            "en": [
              '<span class="personal-comment-bold">that you may</span> - Comment on Pasuk on Rashi',
            ],
            "he": "",
            "id": "0513ae37-3fc6-4ef3-8254-5ce834805b40",
            "ref": "Exodus 11:7-personal0",
            "sourceRef": "Exodus 11:7",
            "sourceHeRef": "Exodus 11:7",
          },
          {
            "en": ["v1 - nested rashi"],
            "he": "",
            "id": undefined,
            "ref": "Exodus 11:7-personal1",
            "sourceRef": "Exodus 11:7",
            "sourceHeRef": "Exodus 11:7",
          },
        ],
        "Pesachim 23a.7": [{
          "en": "",
          "he": ['<span class="personal-comment-bold">עוווווד עמוד</span> - Another amud'],
          "id": "16cf66aa-cab4-4e6b-95c6-1354ceac18bb",
          "ref": "Pesachim 23a.7-personal0",
          "sourceRef": "Pesachim 23a.7",
          "sourceHeRef": "Pesachim 23a.7",
        }],
        "Pesachim 22a.1": [
          {
            "en": "",
            "he": [
              '<span class="personal-comment-bold">תגובההה סטנדריטת</span> - Standard comment',
            ],
            "id": "723ff4af-6b40-4b3f-9594-b8a8203f6ff4",
            "ref": "Pesachim 22a.1-personal0",
            "sourceRef": "Pesachim 22a.1",
            "sourceHeRef": "Pesachim 22a.1",
          },
          {
            "en": "",
            "he": [
              '<span class="personal-comment-bold">תגובההה סטנדרתית 2</span> - Standard comment 2',
            ],
            "id": "3054875a-af39-4cd6-a193-de0d9e9d8a4b",
            "ref": "Pesachim 22a.1-personal1",
            "sourceRef": "Pesachim 22a.1",
            "sourceHeRef": "Pesachim 22a.1",
          },
          {
            "en": ['<span class="personal-comment-bold">יר? אוֹתוֹ</span> - Return to earlier ref'],
            "he": "",
            "id": "c74336ab-90f9-4178-bb2e-36ddf8f8bf18",
            "ref": "Pesachim 22a.1-personal2",
            "sourceRef": "Pesachim 22a.1",
            "sourceHeRef": "Pesachim 22a.1",
          },
        ],
        "Pesachim 22a.3": [{
          "en": "",
          "he": ['<span class="personal-comment-bold">גִּיד הַנָּשֶׁ</span> - הערה בערבית'],
          "id": "cebe9e65-d83a-44f9-99f3-359cd7a590b8",
          "ref": "Pesachim 22a.3-personal0",
          "sourceRef": "Pesachim 22a.3",
          "sourceHeRef": "Pesachim 22a.3",
        }],
        "Rashi on Pesachim 22a:1:1": [
          {
            "en": "",
            "he": [
              '<span class="personal-comment-bold">תגובה ברש״ייייייי</span> - Comment on Rashi',
            ],
            "id": "d7d29ce4-ffbe-4621-99b7-ed8916694799",
            "ref": "Rashi on Pesachim 22a:1:1-personal0",
            "sourceRef": "Rashi on Pesachim 22a:1:1",
            "sourceHeRef": "Rashi on Pesachim 22a:1:1",
          },
          {
            "en": ["v1 - rashi"],
            "he": "",
            "id": undefined,
            "ref": "Rashi on Pesachim 22a:1:1-personal1",
            "sourceRef": "Rashi on Pesachim 22a:1:1",
            "sourceHeRef": "Rashi on Pesachim 22a:1:1",
          },
        ],
        "Pesachim 22a.4": [
          {
            "en": ["V1 comment"],
            "he": "",
            "ref": "Pesachim 22a.4-personal0",
            "sourceRef": "Pesachim 22a.4",
            "sourceHeRef": "Pesachim 22a.4",
          },
          {
            "en": "",
            "he": ["לללללללללללללללללללללל - v1, second comment"],
            "ref": "Pesachim 22a.4-personal1",
            "sourceRef": "Pesachim 22a.4",
            "sourceHeRef": "Pesachim 22a.4",
          },
        ],
        "Pesachim 22a.5": [{
          "en": ["v1 - a new ref"],
          "he": "",
          "ref": "Pesachim 22a.5-personal0",
          "sourceRef": "Pesachim 22a.5",
          "sourceHeRef": "Pesachim 22a.5",
        }],
        "Rashi on Pesachim 22a:1:2": [{
          "en": ["v1 - a second rashi"],
          "he": "",
          "ref": "Rashi on Pesachim 22a:1:2-personal0",
          "sourceRef": "Rashi on Pesachim 22a:1:2",
          "sourceHeRef": "Rashi on Pesachim 22a:1:2",
        }],
      });
    });
});

test("highlights", () => {
  return client.getDatabaseDocument("highlights.json")
    .then(() => {
      expectCommentsToEqual({});
      expectHighlightsToEqual({
        "Otzar Laazei Rashi, Talmud, Pesachim 1": [{
          "highlight": "yellow",
          "id": "c8658266-a06b-4c3c-9efb-f650e67060fa",
          "range": {
            "startIndex": 265,
            "endIndex": 273,
          },
          "text": "ד\"ה יציע",
          "commentSourceMetadata": {
            "startPercentage": 0,
            "endPercentage": 0.04678362573099415,
            "wordCountStart": 0,
            "wordCountEnd": 26,
            "isEnglish": false,
          },
        }],
        "Pesachim 8a.1": [
          {
            "highlight": "yellow",
            "id": "3ba9140b-bc04-4991-a93c-4035a203560d",
            "range": {
              "startIndex": 193,
              "endIndex": 201,
            },
            "text": "לַדָּבָר",
            "commentSourceMetadata": {
              "startPercentage": 0.2215568862275449,
              "endPercentage": 0.24550898203592814,
              "wordCountStart": 10,
              "wordCountEnd": 30,
              "isEnglish": false,
            },
          },
          {
            "highlight": "yellow",
            "id": "447150e2-a113-49bc-867e-9bdf7458dab4",
            "range": {
              "startIndex": 207,
              "endIndex": 215,
            },
            "text": "לַדָּבָר",
            "commentSourceMetadata": {
              "startPercentage": 0.27245508982035926,
              "endPercentage": 0.2964071856287425,
              "wordCountStart": 13,
              "wordCountEnd": 27,
              "isEnglish": false,
            },
          },
        ],
        "Rashi on Pesachim 8a:6:6": [{
          "highlight": "yellow",
          "id": "1bc83b3d-baf8-4905-b46b-c9890800c464",
          "range": {
            "startIndex": 306,
            "endIndex": 324,
          },
          "text": "גג המגדל - משטיי\"ר",
          "commentSourceMetadata": {
            "startPercentage": 0,
            "endPercentage": 0.23684210526315788,
            "wordCountStart": 0,
            "wordCountEnd": 11,
            "isEnglish": false,
          },
        }],
      });
    });
});

test("highlights in multiple colors", () => {
  return client.getDatabaseDocument("highlights-multiple-colors.json")
    .then(() => {
      expectCommentsToEqual({});
      expectHighlightsToEqual({
        "Pesachim 8a.1": [
          {
            "highlight": "blue",
            "id": "3ba9140b-bc04-4991-a93c-4035a203560d",
            "range": {
              "startIndex": 193,
              "endIndex": 201,
            },
            "text": "לַדָּבָר",
            "commentSourceMetadata": {
              "startPercentage": 0.2215568862275449,
              "endPercentage": 0.24550898203592814,
              "wordCountStart": 10,
              "wordCountEnd": 30,
              "isEnglish": false,
            },
          },
          {
            "highlight": "yellow",
            "id": "447150e2-a113-49bc-867e-9bdf7458dab4",
            "range": {
              "startIndex": 207,
              "endIndex": 215,
            },
            "text": "לַדָּבָר",
            "commentSourceMetadata": {
              "startPercentage": 0.27245508982035926,
              "endPercentage": 0.2964071856287425,
              "wordCountStart": 13,
              "wordCountEnd": 27,
              "isEnglish": false,
            },
          },
        ],
        "Rashi on Pesachim 8a:6:6": [{
          "highlight": "yellow",
          "id": "1bc83b3d-baf8-4905-b46b-c9890800c464",
          "range": {
            "startIndex": 306,
            "endIndex": 324,
          },
          "text": "גג המגדל - משטיי\"ר",
          "commentSourceMetadata": {
            "startPercentage": 0,
            "endPercentage": 0.23684210526315788,
            "wordCountStart": 0,
            "wordCountEnd": 11,
            "isEnglish": false,
          },
        }],
      });
    });
});
