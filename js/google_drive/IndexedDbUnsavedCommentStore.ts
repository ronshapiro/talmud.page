import {v4 as uuid} from "uuid";
// @ts-ignore
import {
  DriveClient,
  PersistedComment,
  UnsavedComment,
  UnsavedCommentStore,
  // @ts-ignore
} from "./types.ts";

const NOTES_OBJECT_STORE = "notes";

function result<T>(event: Event): T {
  // @ts-ignore
  return event.target!.result;
}

export class IndexedDbUnsavedCommentStore implements UnsavedCommentStore {
  client?: DriveClient;
  localDb?: IDBDatabase;

  init(client: DriveClient): void {
    this.client = client;
    const openRequest = indexedDB.open("UnsavedNotes", 1);
    openRequest.onerror = event => console.error("db open error", event);
    openRequest.onupgradeneeded = event => {
      const db = result<IDBDatabase>(event);
      db.onerror = (dbError: any) => console.error("db error", dbError);
      db.createObjectStore(NOTES_OBJECT_STORE, {keyPath: "id"});
    };
    openRequest.onsuccess = onSuccessEvent => {
      this.localDb = result<IDBDatabase>(onSuccessEvent);

      this.newTransaction("readonly").getAll().onsuccess = getAllEvent => {
        result<PersistedComment[]>(getAllEvent)
          .filter(comment => comment.masechet === this.client.masechet)
          .forEach(comment => {
            // TODO: do these in a promise chain, since all but the first are guaranteed to fail.
            client.postComment(comment);
          });
      };
    };
  }

  addUnsavedComment(unsavedComment: UnsavedComment): string | undefined {
    if (!this.localDb) {
      console.warn("No local db present");
      return undefined;
    }
    const persisted = {
      ...unsavedComment,
      id: uuid(),
      masechet: this.client.masechet,
    };
    this.newTransaction("readwrite").add(persisted);
    return persisted.id;
  }

  markCommentSaved(id: string): void {
    this.newTransaction("readwrite").delete(id)
      .onerror = event => console.error(event);
  }

  newTransaction(mode: IDBTransactionMode): IDBObjectStore {
    return this.localDb!.transaction(NOTES_OBJECT_STORE, mode).objectStore(NOTES_OBJECT_STORE);
  }
}
