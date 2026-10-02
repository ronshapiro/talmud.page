import * as express from "express";
import {SIDDUR_EDITIONS} from "../model/siddurEditions";
import {mikraotChapter, siddurSectionData} from "./printData";

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
    const commentators = typeof req.query.c === "string" && req.query.c.length > 0
      ? req.query.c.split(",")
      : [];
    mikraotChapter(req.params.book, parseInt(req.params.chapter), commentators)
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
