/* eslint-disable unicorn/prefer-add-event-listener */
import {AbstractIndexedDb, result} from "./AbstractIndexedDb";
import {$} from "./jquery";
import {promiseParts, timeoutPromise} from "./promises";

const TTL = 14 * 24 * 60 * 60 * 1000;

interface AjaxRetryState {
  backoff: number;
  finished: boolean;
}

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

  private ajaxRequest(endpoint: string, maybeState?: AjaxRetryState): Promise<any> {
    const state = maybeState || {backoff: 200, finished: false};
    return $.ajax({
      url: `${window.location.origin}/${endpoint}`,
      type: "GET",
    }).catch(() => {
      if (state.finished) {
        throw new Error("Finished!"); // Lazy cancellation
      }
      state.backoff *= 1.5;
      return timeoutPromise(state.backoff).then(() => this.ajaxRequest(endpoint, state));
    }).then((response: any) => {
      this.save(endpoint, response);
      return response;
    });
  }

  getAndUpdate(endpoint: string): Promise<any> {
    return Promise.any([this.ajaxRequest(endpoint), this.get(endpoint)]);
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
