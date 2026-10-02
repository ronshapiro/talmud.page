import {useCallback, useEffect, useRef, useState} from "react";
import {
  DocumentKind,
  PrintDocument,
  defaultMikraotDocument,
  defaultSiddurDocument,
  isPrintDocument,
  migrateDocument,
} from "../model/documents";
import {documentStore, lastDocumentId} from "../store/documentStore";

declare global {
  interface Window {
    // Injected by the offline PDF renderer (print/cli/render_pdf.ts). When present, the document
    // is used as-is and never persisted.
    __PRINT_DOC__?: PrintDocument;
    // Set once the pages are laid out and fonts are loaded.
    __PRINT_READY__?: boolean;
    __PRINT_STATS__?: unknown;
    // Set when the page can't be laid out (e.g. text failed to load), so the renderer can stop.
    __PRINT_ERROR__?: string;
  }
}

export function reportPrintError(error: unknown): string {
  const message = String(error);
  window.__PRINT_ERROR__ = message;
  return message;
}

export function isHeadless(): boolean {
  return window.__PRINT_DOC__ !== undefined;
}

export function newDocument(kind: DocumentKind): PrintDocument {
  return kind === "siddur" ? defaultSiddurDocument() : defaultMikraotDocument();
}

function setDocParam(id: string) {
  const url = new URL(window.location.href);
  if (url.searchParams.get("doc") !== id) {
    url.searchParams.set("doc", id);
    window.history.replaceState(window.history.state, "", url.toString());
  }
}

async function loadInitialDocument(kind: DocumentKind): Promise<PrintDocument> {
  if (window.__PRINT_DOC__) return migrateDocument(window.__PRINT_DOC__);

  const requested = new URL(window.location.href).searchParams.get("doc");
  if (requested) {
    const existing = await documentStore.get(requested);
    if (existing && existing.kind === kind) return existing;
    // Unknown id: create a document with that id, so that ?doc=foo is a quick way to start a
    // named variant.
    const created = {...newDocument(kind), id: requested, name: requested};
    await documentStore.put(created);
    return created;
  }

  const lastId = lastDocumentId(kind);
  const last = lastId ? await documentStore.get(lastId) : undefined;
  if (last && last.kind === kind) return last;
  const all = await documentStore.list(kind);
  if (all.length > 0) return all[0];
  const created = newDocument(kind);
  await documentStore.put(created);
  return created;
}

export interface DocumentState<T extends PrintDocument> {
  doc?: T;
  error?: string;
  update: (updater: (doc: T) => T) => void;
  replace: (doc: T) => void;
  saving: boolean;
}

/** Loads the document for this page and persists edits (debounced) to IndexedDB. */
export function useDocument<T extends PrintDocument>(kind: DocumentKind): DocumentState<T> {
  const [doc, setDoc] = useState<T>();
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number>();

  useEffect(() => {
    loadInitialDocument(kind)
      .then(x => {
        setDoc(x as T);
        if (!isHeadless()) setDocParam(x.id);
      })
      .catch(e => setError(String(e)));
  }, [kind]);

  const persist = useCallback((next: T) => {
    if (isHeadless()) return;
    setSaving(true);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      documentStore.put(next).finally(() => setSaving(false));
    }, 400);
  }, []);

  const update = useCallback((updater: (doc: T) => T) => {
    setDoc(previous => {
      if (!previous) return previous;
      const next = {...updater(previous), updatedAt: Date.now()};
      persist(next);
      return next;
    });
  }, [persist]);

  const replace = useCallback((next: T) => {
    setDoc(next);
    if (!isHeadless()) {
      documentStore.put(next);
      setDocParam(next.id);
    }
  }, []);

  return {doc, error, update, replace, saving};
}

export function downloadJson(doc: PrintDocument): void {
  const blob = new Blob([JSON.stringify(doc, undefined, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.name.replace(/[^\w -]+/g, "_") || doc.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function pickJsonFile(): Promise<PrintDocument> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      file.text().then(text => {
        const parsed = JSON.parse(text);
        if (!isPrintDocument(parsed)) {
          reject(new Error("Not a print document"));
          return;
        }
        resolve(migrateDocument(parsed));
      }).catch(reject);
    });
    input.click();
  });
}

const loadedFonts = new Set<string>();

/** Ensures the given font families are loaded before measuring. */
export async function loadFonts(families: string[]): Promise<void> {
  const toLoad = families.filter(x => !loadedFonts.has(x));
  await Promise.all(toLoad.flatMap(family => [
    document.fonts.load(`400 16px ${family}`, "אב Ab"),
    document.fonts.load(`700 16px ${family}`, "אב Ab"),
    document.fonts.load(`italic 400 16px ${family}`, "Ab"),
  ]).map(x => x.catch(() => undefined)));
  await document.fonts.ready;
  toLoad.forEach(x => loadedFonts.add(x));
}
