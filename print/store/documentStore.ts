// IndexedDB storage for print documents. One database, one object store keyed by document id.
// Each document is independent, so several layouts can be edited in parallel (in different tabs)
// by opening different ?doc= URLs.

import {AbstractIndexedDb, result} from "../../js/AbstractIndexedDb";
import {DocumentKind, PrintDocument, migrateDocument} from "../model/documents";

const LAST_DOCUMENT_KEY = "print:lastDocument:";

class DocumentDb extends AbstractIndexedDb {
  private ready?: Promise<unknown>;

  protected databaseName(): string {
    return "talmud-page-print";
  }

  protected objectStoreName(): string {
    return "documents";
  }

  private init(): Promise<unknown> {
    if (!this.ready) this.ready = this.open();
    return this.ready;
  }

  private request<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest,
  ): Promise<T> {
    return this.init().then(() => new Promise<T>((resolve, reject) => {
      const request = run(this.newTransaction(mode));
      request.addEventListener("success", event => resolve(result<T>(event)));
      request.addEventListener("error", () => reject(request.error));
    }));
  }

  async list(kind?: DocumentKind): Promise<PrintDocument[]> {
    const all = await this.request<PrintDocument[]>("readonly", store => store.getAll());
    return all
      .filter(x => !kind || x.kind === kind)
      .map(migrateDocument)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async get(id: string): Promise<PrintDocument | undefined> {
    const doc = await this.request<PrintDocument | undefined>("readonly", store => store.get(id));
    return doc ? migrateDocument(doc) : undefined;
  }

  put(doc: PrintDocument): Promise<unknown> {
    localStorage.setItem(LAST_DOCUMENT_KEY + doc.kind, doc.id);
    return this.request("readwrite", store => store.put(doc));
  }

  delete(id: string): Promise<unknown> {
    return this.request("readwrite", store => store.delete(id));
  }
}

export const documentStore = new DocumentDb();

export function lastDocumentId(kind: DocumentKind): string | undefined {
  return localStorage.getItem(LAST_DOCUMENT_KEY + kind) ?? undefined;
}
