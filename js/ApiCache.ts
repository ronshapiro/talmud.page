/* eslint-disable unicorn/prefer-add-event-listener */
import {AbstractIndexedDb, result} from "./AbstractIndexedDb";
import {promiseParts} from "./promises";

export class ApiCache extends AbstractIndexedDb {
  private whenDbReady: Promise<unknown>;

  constructor() {
    super();
    this.whenDbReady = this.open();
  }

  save(ref: string, value: any): void {
    this.whenDbReady.then(() => {
      this.newTransaction("readwrite").add({
        "id": ref,
        wrapped: value,
      });
    });
  }

  get(ref: string): Promise<any> {
    const [promise, onSuccess] = promiseParts<any>().slice(0, 2);
    return this.whenDbReady.then(() => {
      this.newTransaction("readonly").get(ref).onsuccess = event => {
        onSuccess(result(event).wrapped);
      };
      return promise;
    }
  }

  protected databaseName(): string {
    return "ApiCache";
  }

  protected objectStoreName(): string {
    return "api_cache";
  }
}
