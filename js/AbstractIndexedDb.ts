import {promiseParts} from "./promises";

/* eslint-disable unicorn/prefer-add-event-listener */
export function result<T>(event: Event): T {
  // @ts-ignore
  return event.target!.result;
}

export abstract class AbstractIndexedDb {
  localDb?: IDBDatabase;

  protected open(): Promise<unknown> {
    const openRequest = indexedDB.open(this.databaseName(), 1);
    const [promise, onSuccess, onError] = promiseParts<unknown>();
    openRequest.onerror = event => {
      console.error("db open error", event);
      onError(undefined);
    };
    openRequest.onupgradeneeded = event => {
      const db = result<IDBDatabase>(event);
      db.onerror = (dbError: any) => console.error("db error", dbError);
      db.createObjectStore(this.objectStoreName(), {keyPath: "id"});
    };
    openRequest.onsuccess = onSuccessEvent => {
      this.localDb = result<IDBDatabase>(onSuccessEvent);
      onSuccess(undefined);
    };
    return promise;
  }

  protected abstract databaseName(): string;

  protected abstract objectStoreName(): string;

  newTransaction(mode: IDBTransactionMode): IDBObjectStore {
    const objectStoreName = this.objectStoreName();
    return this.localDb!.transaction(objectStoreName, mode).objectStore(objectStoreName);
  }
}
