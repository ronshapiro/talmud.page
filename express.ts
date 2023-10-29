import * as express from "express";
import * as fs from "fs";
import * as http from "http";
import {JewishCalendar} from "kosher-zmanim";
import * as nunjucks from "nunjucks";
import * as sendgrid from "@sendgrid/mail";
import {range} from "underscore";
import {parse as urlParse} from "url";
import {v4 as uuid} from "uuid";
import {
  Book,
  books,
  InvalidQueryException,
  nextAmud,
  previousAmud,
  QueryResult,
  UnknownBookNameException,
} from "./books";
import {
  ApiErrorResponse,
  ApiResponse,
} from "./apiTypes";
import {WeightBasedLruCache} from "./cache";
import {CorrectionPostData} from "./correctionTypes";
import {htmlEscape} from "./html_escape";
import {ConsoleLogger, Timer} from "./logger";
import {PromiseChain} from "./js/promises";
import {RealRequestMaker} from "./request_makers";
import {Sitemap} from "./robots";
import {jsonSize} from "./util/json_size";
import {writeJson} from "./util/json_files";
import {getWeekdayReading} from "./weekday_parshiot";

const app = express();
const debug = app.settings.env === "development";

nunjucks.configure("dist", {
  autoescape: true,
  express: app,
});

const randomHash = (() => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  // eslint-disable-next-line unicorn/new-for-builtins
  return [...Array(8)].map(_ => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
})();

class Logger extends ConsoleLogger {
  constructor(private readonly endpoint: string) {
    super();
  }

  error(...args: any[]) {
    super.error("ERROR", "|", this.endpoint, "|", ...args);
  }

  log(...args: any[]) {
    // eslint-disable-next-line no-console
    super.log("LOG  ", "|", this.endpoint, "|", ...args);
  }

  debug(...args: any[]) {
    // don't use console.debug, as that will get dropped by App Engine
    // eslint-disable-next-line no-console
    super.debug("DEBUG", "|", this.endpoint, "|", ...args);
  }

  newTimer(): Timer {
    return new Timer(this);
  }
}

declare module "express-serve-static-core/index" {
  interface Request {
    logger: Logger;
    timer: Timer;
  }

  interface Response {
    redirectWithQueryParameters: (endpoint: string) => void;
  }
}

function createLogger(req: express.Request): Logger {
  const endpoint = (
    debug
      ? req.originalUrl
      : `${req.originalUrl} by ${req.ip}`);
  return new Logger(endpoint);
}

app.use((req, res, next) => {
  req.logger = createLogger(req);
  if (debug) {
    req.logger.debug("<incoming>");
  }
  req.timer = req.logger.newTimer();

  const superRender = res.render;
  res.render = function render(...args: Parameters<typeof superRender>) {
    // @ts-ignore
    args[1] = Object.assign(args[1] || {}, {
      debug,
      random_hash: randomHash,
    });
    superRender.call(this, ...args);// view, options, callback);
  };

  const superSendFile = res.sendFile;
  res.sendFile = function sendFile(...args: Parameters<typeof superSendFile>) {
    args[0] = `${__dirname}/${args[0]}`;
    superSendFile.call(this, ...args);
  };

  res.redirectWithQueryParameters = (endpoint: string) => {
    const search = urlParse(req.originalUrl).search ?? "";
    return res.redirect(endpoint + search);
  };

  next();
});

function sendLazyStaticFile(res: express.Response, file: string) {
  res.sendFile(file, {
    headers: {
      'Cache-Control': 'max-age=86400, stale-while-revalidate=7776000',
    },
  });
}

app.use((req, res, next) => {
  if (req.hostname.startsWith("www.")) {
    res.redirectWithQueryParameters(req.hostname.slice(4) + req.originalUrl);
  } else {
    next();
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => res.render("homepage.html"));
app.get("/css/:ignored/:path", (req, res) => sendLazyStaticFile(res, `css/${req.params.path}`));

for (const file of fs.readdirSync("dist").filter(x => !x.endsWith(".html"))) {
  app.get(`/${file}`, (req, res) => res.sendFile(`dist/${file}`, {maxAge: 31536000}));
}

const STATIC_FILES_LAZY_CACHE_OPTIONS = {
  setHeaders: (res: express.Response) => {
    res.setHeader('Cache-Control', 'max-age=86400, stale-while-revalidate=7776000');
  },
};

app.use(express.static("favicon", STATIC_FILES_LAZY_CACHE_OPTIONS));
app.use("/font", express.static("fonts", STATIC_FILES_LAZY_CACHE_OPTIONS));

function segmentUrl(bookName: string, start: string, end?: string): string {
  return (end
    ? `/${bookName}/${start}/to/${end}`
    : `/${bookName}/${start}`);
}

function isNumeric(x: string) {
  return parseInt(x).toString() === x;
}

function fullDafUrl(masechet: Book, start: string, end: string): string {
  const originalStart = start;
  const originalEnd = end;

  if (isNumeric(start)) {
    start = `${start}a`;
  }
  if (isNumeric(end)) {
    end = `${end}b`;
  }
  if (!masechet.doesSectionExist(start)
    && masechet.doesSectionExist(nextAmud(start))) {
    start = nextAmud(start);
  }
  if (!masechet.doesSectionExist(end)
    && masechet.doesSectionExist(previousAmud(end))) {
    end = previousAmud(end);
  }

  if (masechet.arePagesInReverseOrder(start, end)) {
    return fullDafUrl(masechet, originalEnd, originalStart);
  }

  return segmentUrl(masechet.canonicalName, start, end);
}

app.get("/api/search/:query", (req, res) => {
  const {query} = req.params;
  let parsed: any;
  try {
    parsed = books.parseWithGuesses(query);
  } catch (e) {
    if (e instanceof InvalidQueryException) {
      return res.send({error: e.message});
    } else {
      throw e;
    }
  }

  if (parsed instanceof QueryResult) {
    return res.send({path: parsed.toUrlPathname()});
  } else if (parsed.guesses) {
    return res.send(parsed);
  }
  throw new Error(`Don't know what to do with: ${query} and ${parsed}`);
});

app.get(
  "/manifest.json",
  (req, res) => sendLazyStaticFile(res, "static/progressive_webapp_manifest.json"));

for (const [endpoint, url] of [
  [
    "/caveats/google-docs",
    "https://github.com/ronshapiro/talmud.page/blob/base/GoogleDriveCaveats.md",
  ],
  ["/notes", "https://drive.google.com/drive/search?q=talmud.page notes"],
]) {
  app.get(endpoint, (req, res) => res.redirect(url));
}

app.get("/:title/notes", (req, res) => {
  const {title} = req.params;
  const canonicalName = books.canonicalUrlName(title);
  if (canonicalName !== title) {
    return res.redirectWithQueryParameters(`/${canonicalName}/notes`);
  }
  return res.render("notes_redirecter.html", {title, bookTitle: title});
});

app.get("/daf-yomi", (req, res) => res.render("daf_yomi_redirector.html"));
app.get("/yomi", (req, res) => res.redirectWithQueryParameters("/daf-yomi"));

class PagesDontExistError extends Error {
  constructor(book: Book, nonExistentPages: string[]) {
    if (nonExistentPages.length === 1) {
      super(`${book.canonicalName} ${nonExistentPages[0]} doesn't exist`);
    } else {
      const parts = [`${book.canonicalName} ${nonExistentPages[0]}`];
      for (const page of nonExistentPages.slice(1, -1)) {
        parts.push(`, ${page}`);
      }
      parts.push(` and ${nonExistentPages.slice(-1)[0]} don't exist`);
      super(parts.join(""));
    }

    Object.setPrototypeOf(this, PagesDontExistError.prototype);
  }
}

function validatePages(book: Book, ...pages: string[]) {
  pages = pages.map(page => page.replace(/_/g, " "));
  const nonExistentPages = pages.filter(x => !book.doesSectionExist(x));
  if (nonExistentPages.length > 0) {
    throw new PagesDontExistError(book, nonExistentPages);
  }
}

app.get("/SiddurAshkenaz", (req, res) => {
  return res.render("siddur_page.html", {title: "Siddur Ashkenaz", bookTitle: "SiddurAshkenaz"});
});

app.get("/SiddurSefard", (req, res) => {
  return res.render("siddur_page.html", {title: "Siddur Sefard", bookTitle: "SiddurSefard"});
});

app.get("/BirkatHamazon", (req, res) => {
  return res.render(
    "birkat_hamazon_page.html", {title: "Birkat Hamazon", bookTitle: "BirkatHamazon"});
});

function template(book: Book): string {
  return book.isMasechet() ? "talmud_page.html" : "tanakh.html";
}

app.get("/:title/:section", (req, res) => {
  const {title, section} = req.params;
  const canonicalName = books.canonicalUrlName(title);
  if (canonicalName !== title) {
    return res.redirectWithQueryParameters(`/${canonicalName}/${section}`);
  }
  const book = books.byCanonicalName[title];
  if (book.isMasechet() && isNumeric(section)) {
    return res.redirectWithQueryParameters(fullDafUrl(book, section, section));
  }
  validatePages(book, section);
  return res.render(template(book), {title: `${title} ${section}`, bookTitle: book.canonicalName});
});

app.get("/:title/:start/to/:end", (req, res) => {
  const {title, start, end} = req.params;
  if (start === end) {
    return res.redirectWithQueryParameters(`/${title}/${start}`);
  }
  const canonicalName = books.canonicalUrlName(title);
  if (canonicalName !== title) {
    return res.redirectWithQueryParameters(`/${canonicalName}/${start}/to/${end}`);
  }

  const book = books.byCanonicalName[title];
  if (book.isMasechet() && (isNumeric(start) || isNumeric(end))) {
    return res.redirectWithQueryParameters(fullDafUrl(book, start, end));
  }

  validatePages(book, start, end);

  if (book.arePagesInReverseOrder(start, end)) {
    return res.redirectWithQueryParameters(`/${title}/${end}/to/${start}`);
  }

  return res.render(template(book), {title: `${title} ${start} - ${end}`, bookTitle: book.canonicalName});
});

class CacheValue<T> {
  constructor(
    readonly promise: Promise<T>,
    readonly actualValue?: T | undefined) {}
}

const apiResponseCache = new WeightBasedLruCache<
    CacheValue<[ApiResponse | ApiErrorResponse, number]>>(
      150 * 1e6, // 150MB,
      v => (v.actualValue ? jsonSize(v.actualValue[0]) : 0),
    );

async function getAndCacheApiResponse(
  title: string,
  page: string,
  logger: Logger,
  verb = "Requesting",
): Promise<[ApiResponse | ApiErrorResponse, number]> {
  // Load these types lazily to defer slow JSDOM import from source_formatting/html_visitor.ts
  const {ApiException, ApiRequestHandler} = await import("./api_request_handler");
  const apiRequestHandler = new ApiRequestHandler(new RealRequestMaker(), logger);

  const cacheKey = `${title} % ${page}`;
  const cached = apiResponseCache.get(cacheKey);
  if (cached) {
    logger.debug("cache hit");
    return cached.promise;
  }

  logger.log(verb);
  const originalPromise = apiRequestHandler.handleRequest(title, page)
    .then(response => {
      logger.log(`${verb} --- Done`);
      const newValue: [ApiResponse, number] = [response, 200];
      const newPromise = Promise.resolve(newValue);
      apiResponseCache.put(cacheKey, new CacheValue(newPromise, newValue));
      return newPromise;
    })
    .catch((e: Error) => {
      apiResponseCache.remove(cacheKey);
      if (e instanceof ApiException) {
        return Promise.resolve<[ApiErrorResponse, number]>([{
          error: e.message,
          code: e.internalCode,
        }, e.httpStatus]);
      }
      const _uuid = uuid();
      logger.error(_uuid, e);
      return Promise.resolve<[ApiErrorResponse, number]>([{
        error: "An unknown error occurred.",
        id: _uuid,
      }, 500]);
    });
  apiResponseCache.put(cacheKey, new CacheValue(originalPromise));

  return originalPromise;
}

const preCachedPageStack: [string, string, Logger][] = [];
// This ensures that at most 1 request is being precached at a time, so that hopefully they don't
// take too much precedence over actual requests
const preCachingPromiseChain = new PromiseChain();

function precache(title: string, page: string, logger: Logger) {
  preCachedPageStack.push([title, page, logger]);
  preCachingPromiseChain.add(() => {
    return getAndCacheApiResponse(...preCachedPageStack.pop()!, "Precaching");
  });
}

app.get("/api/:title/:page", (req, res) => {
  const {title, page} = req.params;
  const canonicalName = books.canonicalUrlName(title);
  if (canonicalName !== title) {
    return res.redirectWithQueryParameters(`/api/${canonicalName}/${page}`);
  }

  const book = books.byCanonicalName[title];
  try {
    validatePages(book, page);
  } catch (e: any) {
    return res.status(404).send({error: e.message});
  }

  const promiseChain = new PromiseChain(
    getAndCacheApiResponse(title, page, req.logger)
      .then(result => {
        const [response, code] = result;
        return res.status(code).json(response);
      })
      .catch(e => {
        req.logger.error(e);
        res.status(500).json({error: "Internal Server Error"});
      })
      .finally(() => req.timer.finish("complete after")));


  for (const possiblePage of [book.nextPage(page), book.previousPage(page)]) {
    if (book.doesSectionExist(possiblePage)) {
      const logger = new Logger(`${req.originalUrl} [Precaching ${possiblePage}]`);
      promiseChain.add(() => precache(title, possiblePage, logger));
    }
  }

  return undefined;
});

app.get("/api/WeekdayTorah/:year/:month/:day/:inIsrael", (req, res) => {
  const {year, month, day, inIsrael} = req.params;
  const date = new JewishCalendar(
    parseInt(year), parseInt(month), parseInt(day), inIsrael === "true");

  Promise.all(
    range(getWeekdayReading(date)!.length).map(
      x => getAndCacheApiResponse(
        "WeekdayTorah", [year, month, day, inIsrael, x].join("/"), req.logger)),
  ).then(responses => {
    const codes = [];
    const allResponses = [];
    for (const [response, code] of responses) {
      codes.push(code);
      allResponses.push(response);
    }
    for (const code of codes) {
      if (code !== 200) {
        throw new Error(codes.join(", "));
      }
    }
    res.status(200).send({aliyot: allResponses});
  });
});

app.get("/draw", (req, res) => res.render("draw.html"));
app.get("/draw/image/*", (req, res) => res.sendFile("draw_images/1495_300ppi.jpg"));

app.get("/robots.txt", (req, res) => {
  res.set("Cache-control", `public, max-age=${60 * 60 * 24 * 90}`);
  res.status(200).type("txt").send(`User-agent: *
Allow: /

Sitemap: https://${req.hostname}/sitemap.xml`);
});

app.get('/sitemap.xml', (req, res) => {
  res.status(200)
    .header('Content-Type', 'application/xml')
    .send(new Sitemap(`https://${req.hostname}`).generate());
});

if (fs.existsSync("sendgrid_api_key")) {
  sendgrid.setApiKey(fs.readFileSync("sendgrid_api_key", {encoding: "utf-8"}));
  app.post("/corrections", async (req, res) => {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log("Not sending correction in debug mode", req.body);
      res.status(200).send({});
      return;
    }
    const params: CorrectionPostData = req.body;
    const {
      ref,
      url,
      hebrew,
      hebrewHighlighted,
      translation,
      translationHighlighted,
      userText,
      user,
      pathname,
    } = params;
    const {EscapeHtmlHighlightCorrections} = await import(
      "./source_formatting/escape_html_corrections");
    const maybeExcapeHighlightedSection = (text: string | undefined) => {
      return text && EscapeHtmlHighlightCorrections.process(text);
    };
    const isSiddur = pathname.startsWith("/Siddur") || pathname.startsWith("/BirkatHamazon");
    const to = isSiddur ? "siddur@talmud.page" : "corrections@sefaria.org";
    const subject = (
      isSiddur ? "Siddur Feedback - talmud.page" : "Sefaria Text Correction from talmud.page");
    const cc = [user];
    if (!isSiddur) {
      cc.push("corrections@talmud.page");
    }
    const rtl = (text: string | undefined) => text && `<div dir="rtl">${text}</div>`;
    sendgrid.send({
      to,
      from: "corrections@talmud.page",
      cc,
      subject,
      text: [
        `${ref} (${url})`,
        hebrew,
        translation,
        `Describe the error: ${userText}`,
      ].filter(x => x !== "").join("\n\n"),
      html: [
        `<a href="${htmlEscape(url)}">${htmlEscape(ref)}</a>`,
        rtl(maybeExcapeHighlightedSection(hebrewHighlighted || hebrew)),
        maybeExcapeHighlightedSection(translationHighlighted || translation),
        `<b>Describe the error:</b> ${htmlEscape(userText)}`,
      ].filter(x => x && x !== "").join("<br><br>"),
    }).then(() => res.status(200).send({}))
      .catch(e => {
        console.error(e, e?.response?.body || {});
        res.sendStatus(500);
      });
  });

  app.post("/feedback", async (req, res) => {
    if (debug) {
      req.logger.error("Not sending emails in debug mode", req.body);
      res.status(200).send({});
      return;
    }
    const userId = req.body.localStorage.userUuid ?? "<somehow missing>";
    const text: string[] = [];
    const html: string[] = [];
    const addLog = (map: any, heading: string) => {
      text.push(heading);
      html.push(`<h3>${heading}</h3><ul>`);
      for (const [key, value] of Object.entries(map)) {
        text.push(`- ${key}: ${value}`);
        html.push(`<li>${key}: <b>${value}</b></li>`);
      }
      html.push("</ul>");
    };
    if (req.body.ignored) {
      text.push("Form Ignored");
      html.push("<h1>Form Ignored</h1>");
    } else {
      addLog(req.body.form, "Feedback data");
    }
    addLog(req.body.localStorage, "localStorage");

    sendgrid.send({
      to: "feedback-form@talmud.page",
      from: "corrections@talmud.page",
      subject: `Feedback Form: ${userId} ${req.body.ignored ? "IGNORED" : ""}`.trim(),
      text: text.join("\n"),
      html: html.join(""),
    }).then(() => res.status(200).send({}))
      .catch(e => {
        console.error(e, e?.response?.body || {});
        res.sendStatus(500);
      });
  });

  app.post("/event", async (req, res) => {
    if (debug) {
      req.logger.error("Not sending emails in debug mode", req.body);
      res.status(200).send({});
      return;
    }
    const userId = req.body.localStorage.userUuid ?? "<somehow missing>";
    const text: string[] = [];
    const html: string[] = ["<ul>"];
    for (const [key, value] of Object.entries(req.body)) {
      if (key === "subject") continue;
      text.push(`- ${key}: ${value}`);
      html.push(`<li>${key}: ${value}</li>`);
    }
    html.push("</ul>");

    sendgrid.send({
      to: "event@talmud.page",
      from: "corrections@talmud.page",
      subject: `Event: ${userId} ${req.body.subject ?? ""}`.trim(),
      text: text.join("\n"),
      html: html.join(""),
    }).then(() => res.status(200).send({}))
      .catch(e => {
        console.error(e, e?.response?.body || {});
        res.sendStatus(500);
      });
  });
}

if (debug) {
  app.post("/google-docs-record", (req, res) => {
    const dataDump = req.body;
    dataDump.revisionId = "revisionId";
    delete dataDump.documentStyle;
    delete dataDump.namedStyles;
    delete dataDump.suggestionsViewMode;
    writeJson("js/google_drive/__tests__/do_not_submit_rename_me.json", dataDump);
    res.send("");
  });
}

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const send404 = (message: string, title: string) => {
    return res.status(404).render("error_page.html", {message, title});
  };

  if (err instanceof PagesDontExistError) {
    return send404(err.message, "Error");
  } else if (err instanceof InvalidQueryException) {
    return send404(err.message, "Invalid Query");
  } else if (err instanceof UnknownBookNameException) {
    return send404(`Could not find title ${err.name}`, "Invalid Query");
  }

  return next(err);
});

// This should be last so that no it doesn't interrupt other middleware
app.use((req, res) => {
  return res.status(404).render("error_page.html", {
    message: "We don't know what happened!",
    title: "Unknown Error",
  });
});

export function expressMain(port: number): http.Server {
  return app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Express listening on ${port}`);
  });
}
