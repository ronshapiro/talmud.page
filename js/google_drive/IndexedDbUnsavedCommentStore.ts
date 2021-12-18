/* eslint-disable unicorn/prefer-add-event-listener */
import {v4 as uuid} from "uuid";
import {PromiseChain} from "../promises";
import {
  DriveClient,
  PersistedComment,
  PostCommentParams,
  UnsavedCommentStore,
} from "./types";
import {AbstractIndexedDb, result} from "../AbstractIndexedDb";

export class IndexedDbUnsavedCommentStore extends AbstractIndexedDb implements UnsavedCommentStore {
  client?: DriveClient;

  init(client: DriveClient): void {
    this.client = client;
    this.open().then(() => {
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
    });
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

  protected databaseName(): string {
    return "UnsavedNotes";
  }

  protected objectStoreName(): string {
    return "notes";
  }
}
