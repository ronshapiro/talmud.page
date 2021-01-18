import {v4 as uuid} from "uuid";
import {PromiseChain} from "../promises";
import {
  DriveClient,
  PersistedComment,
  PostCommentParams,
  UnsavedCommentStore,
} from "./types";

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

      const promiseChain = new PromiseChain();
      this.newTransaction("readonly").getAll().onsuccess = getAllEvent => {
        result<PersistedComment[]>(getAllEvent)
          .filter(comment => comment.masechet === this.client!.masechet)
          .forEach(comment => {
            // execute in a promise chain so that the updates of one comment don't cause the
            // others to fail + require a retry
            promiseChain.add(() => client.postComment(comment));
          });
      };
    };
  }

  addUnsavedComment(unsavedComment: PostCommentParams): string | undefined {
    if (!this.localDb) {
      console.warn("No local db present");
      return undefined;
    }
    const persisted = {
      ...unsavedComment,
      id: uuid(),
      masechet: this.client!.masechet,
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
