import * as React from "react";
import {useEffect, useState} from "react";
import {PrintDocument} from "../model/documents";
import {documentStore} from "../store/documentStore";

function DocumentRows({docs, kind}: {docs: PrintDocument[]; kind: "siddur" | "mikraot"}) {
  const ofKind = docs.filter(x => x.kind === kind);
  return (
    <ul>
      {ofKind.map(doc => (
        <li key={doc.id}>
          <a href={`/print/${kind}?doc=${encodeURIComponent(doc.id)}`}>{doc.name}</a>
          <span className="hint"> · edited {new Date(doc.updatedAt).toLocaleString()}</span>
        </li>
      ))}
      <li><a href={`/print/${kind}?doc=${encodeURIComponent(`${kind}-${Date.now().toString(36)}`)}`}>+ New</a></li>
    </ul>
  );
}

export function DocumentList(): React.ReactElement {
  const [docs, setDocs] = useState<PrintDocument[]>([]);
  useEffect(() => {
    documentStore.list().then(setDocs);
  }, []);
  return (
    <div className="print-home">
      <h1>Print layouts</h1>
      <p className="hint">
        Each document is an independent configuration stored in this browser. Open several in
        different tabs to work on variants in parallel; use Export to save one as JSON for the
        offline PDF renderer.
      </p>
      <h2>Siddur</h2>
      <DocumentRows docs={docs} kind="siddur" />
      <h2>Mikraot Gedolot</h2>
      <DocumentRows docs={docs} kind="mikraot" />
    </div>
  );
}
