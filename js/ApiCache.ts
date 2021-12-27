/* eslint-disable unicorn/prefer-add-event-listener */
import {AbstractIndexedDb, result} from "./AbstractIndexedDb";
import {promiseParts} from "./promises";

const TTL = 14 * 24 * 60 * 60 * 1000;

export class ApiCache extends AbstractIndexedDb {
  private whenDbReady: Promise<unknown>;

  constructor() {
    super();
    this.whenDbReady = this.open();
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  save(ref: string, value: any): void {
    this.whenDbReady.then(() => {
      this.newTransaction("readwrite").put({
        id: ref,
        insertTimeMillis: Date.now(),
        wrapped: value,
      });
    });
  }

  get(ref: string): Promise<any> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [promise, onSuccess, onFailure] = promiseParts();
    return this.whenDbReady.then(() => {
      this.newTransaction("readonly").get(ref).onsuccess = event => {
        const resultValue = result(event);
        if (resultValue !== undefined) {
          onSuccess((resultValue as any).wrapped);
        }
      };
      return promise;
    });
  }

  private purge() {
    const objectStore = this.newTransaction("readwrite");
    objectStore.getAll().onsuccess = getAllEvent => {
      const now = Date.now();
      for (const row of result<any>(getAllEvent)) {
        if ((now - row.insertTimeMillis) > TTL) {
          objectStore.delete(row.id);
        }
      }
    };
  }

  protected databaseName(): string {
    return "ApiCache";
  }

  protected objectStoreName(): string {
    return "api_cache";
  }
}
