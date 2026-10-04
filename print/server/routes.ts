import * as express from "express";
import {SIDDUR_EDITIONS} from "../model/siddurEditions";
import {
  mikraotChapter,
  mikraotSources,
  probeSource,
  siddurSectionData,
  translationVersions,
} from "./printData";

function sendError(res: express.Response, e: any) {
  res.status(500).json({error: e?.message ?? String(e)});
}

/**
 * Registers the print data API and page routes. `renderPage` sends the built print.html; it
 * differs between the main server (nunjucks) and the standalone PDF server (static file).
 */
export function registerPrintRoutes(
  app: express.Express,
  renderPage: (res: express.Response) => void,
): void {
  app.get("/api/print/mikraot/:book/:chapter", (req, res) => {
    // p: "|"-separated ref prefixes; v: translation versionTitle.
    const prefixes = typeof req.query.p === "string" && req.query.p.length > 0
      ? req.query.p.split("|")
      : [];
    const translation = typeof req.query.v === "string" && req.query.v ? req.query.v : undefined;
    mikraotChapter(req.params.book, parseInt(req.params.chapter), prefixes, translation)
      .then(x => res.json(x))
      .catch(e => sendError(res, e));
  });

  app.get("/api/print/mikraot-sources/:book/:chapter", (req, res) => {
    mikraotSources(req.params.book, parseInt(req.params.chapter))
      .then(x => res.json(x))
      .catch(e => sendError(res, e));
  });

  app.get("/api/print/mikraot-probe/:chapter", (req, res) => {
    const prefix = typeof req.query.p === "string" ? req.query.p : "";
    probeSource(prefix, parseInt(req.params.chapter))
      .then(x => res.json(x))
      .catch(e => res.status(404).json({error: e?.message ?? String(e)}));
  });

  app.get("/api/print/versions/:book", (req, res) => {
    translationVersions(req.params.book)
      .then(x => res.json(x))
      .catch(e => sendError(res, e));
  });

  app.get("/api/print/siddur/editions", (req, res) => {
    res.json(SIDDUR_EDITIONS);
  });

  app.get("/api/print/siddur/:edition/section", (req, res) => {
    const {id} = req.query;
    if (typeof id !== "string") {
      res.status(400).json({error: "Missing ?id="});
      return;
    }
    siddurSectionData(req.params.edition, id)
      .then(x => res.json(x))
      .catch(e => sendError(res, e));
  });

  for (const route of ["/print", "/print/siddur", "/print/mikraot"]) {
    app.get(route, (req, res) => renderPage(res));
  }
}
