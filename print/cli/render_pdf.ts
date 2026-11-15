/* eslint-disable no-console */
// Offline renderer: lays out a print document in headless Chrome/Chromium and writes a PDF (and
// optionally per-page PNGs). The layout runs in the same code as the browser view, so the output
// matches what you see on screen.
//
// Examples:
//   npx ts-node print/cli/render_pdf.ts --doc my-siddur.json --out siddur.pdf
//   npx ts-node print/cli/render_pdf.ts --kind mikraot --set book=Exodus --set startChapter=20 \
//       --set endChapter=20 --out exodus20.pdf --png-dir /tmp/pages
//
// Options:
//   --doc FILE         A document exported from the browser (Export button). Or:
//   --kind KIND        Start from the default "siddur" or "mikraot" document.
//   --set PATH=VALUE   Override a field (dotted path; VALUE parsed as JSON if possible).
//                      Repeatable.
//   --out FILE         PDF output path.
//   --png-dir DIR      Also write page PNGs (page-001.png, …).
//   --pages A-B        Limit PNG output to a page range (1-based, inclusive).
//   --scale N          PNG device scale factor (default 2).
//   --spreads          PNGs of facing spreads instead of single pages.
//   --url URL          Use an already-running server (e.g. http://localhost:5001) instead of
//                      building and starting one.
//   --offline          Never fetch from the network; use cached_outputs/print only.
//   --chrome PATH      Browser executable (defaults to installed Google Chrome, then Chromium).
//   --no-build         Reuse the existing print/.dist bundle.

import * as fs from "fs";
import * as path from "path";
import {
  PrintDocument,
  defaultMikraotDocument,
  defaultSiddurDocument,
  migrateDocument,
} from "../model/documents";
import {setOfflineMode} from "../server/printData";
import {buildPrintBundle, startPrintServer} from "./printServer";

interface Args {
  help?: boolean;
  spreads?: boolean;
  doc?: string;
  kind?: string;
  set: string[];
  out?: string;
  pngDir?: string;
  pages?: [number, number];
  scale: number;
  url?: string;
  offline: boolean;
  chrome?: string;
  build: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {set: [], scale: 2, offline: false, build: true};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => argv[++i];
    switch (arg) {
      case "--doc": args.doc = next(); break;
      case "--kind": args.kind = next(); break;
      case "--set": args.set.push(next()); break;
      case "--out": args.out = next(); break;
      case "--png-dir": args.pngDir = next(); break;
      case "--pages": {
        const [a, b] = next().split("-").map(x => parseInt(x));
        args.pages = [a, b ?? a];
        break;
      }
      case "--scale": args.scale = parseFloat(next()); break;
      case "--url": args.url = next(); break;
      case "--offline": args.offline = true; break;
      case "--spreads": args.spreads = true; break;
      case "--chrome": args.chrome = next(); break;
      case "--no-build": args.build = false; break;
      case "--help":
      case "-h":
        args.help = true;
        return args;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (args.help) return args;
  if (!args.doc && !args.kind) throw new Error("Pass --doc FILE or --kind siddur|mikraot");
  if (!args.out && !args.pngDir) throw new Error("Pass --out FILE and/or --png-dir DIR");
  return args;
}

function setPath(target: any, dotted: string, rawValue: string) {
  let value: any = rawValue;
  try {
    value = JSON.parse(rawValue);
  } catch {
    // Keep as a string.
  }
  const keys = dotted.split(".");
  let node = target;
  for (const key of keys.slice(0, -1)) {
    if (node[key] === undefined) node[key] = {};
    node = node[key];
  }
  node[keys[keys.length - 1]] = value;
}

function loadDocument(args: Args): PrintDocument {
  let doc: PrintDocument;
  if (args.doc) {
    doc = migrateDocument(JSON.parse(fs.readFileSync(args.doc, "utf8")));
  } else if (args.kind === "siddur") {
    doc = defaultSiddurDocument();
  } else if (args.kind === "mikraot") {
    doc = defaultMikraotDocument();
  } else {
    throw new Error(`Unknown kind: ${args.kind}`);
  }
  for (const assignment of args.set) {
    const index = assignment.indexOf("=");
    setPath(doc, assignment.slice(0, index), assignment.slice(index + 1));
  }
  return doc;
}

async function launchBrowser(chrome?: string) {
  const {chromium} = await import("playwright-core");
  if (chrome) return chromium.launch({executablePath: chrome});
  try {
    return await chromium.launch({channel: "chrome"});
  } catch {
    return chromium.launch();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    const usage = fs.readFileSync(__filename, "utf8").split("\n").filter(x => x.startsWith("//"));
    console.log(usage.join("\n"));
    return;
  }
  const doc = loadDocument(args);

  let baseUrl = args.url;
  let server: {close: () => void} | undefined;
  if (!baseUrl) {
    if (args.offline) setOfflineMode(true);
    if (args.build) {
      console.log("Building print bundle…");
      await buildPrintBundle(false);
    }
    const port = 5100 + Math.floor(Math.random() * 800);
    server = await startPrintServer(port);
    baseUrl = `http://localhost:${port}`;
  }

  const browser = await launchBrowser(args.chrome);
  try {
    const context = await browser.newContext({
      deviceScaleFactor: args.scale,
      viewport: {width: 1600, height: 1200},
    });
    const page = await context.newPage();
    page.on("pageerror", error => console.error("[page error]", error.message));
    page.on("console", message => {
      if (message.type() === "error") console.error("[console]", message.text());
    });
    const viewMode = args.spreads ? "spreads" : "single";
    await page.addInitScript(`localStorage.setItem("print:viewMode", "${viewMode}");
      localStorage.setItem("print:zoom", "1");
      window.__PRINT_DOC__ = ${JSON.stringify(doc)};`);
    const started = Date.now();
    await page.goto(`${baseUrl}/print/${doc.kind}`);
    await page.waitForFunction(
      () => (window as any).__PRINT_READY__ === true || (window as any).__PRINT_ERROR__,
      undefined,
      {timeout: 10 * 60_000});
    const error = await page.evaluate(() => (window as any).__PRINT_ERROR__);
    if (error) throw new Error(`Layout failed: ${error}`);
    const stats = await page.evaluate(() => (window as any).__PRINT_STATS__);
    console.log(`Laid out in ${Date.now() - started} ms:`, JSON.stringify(stats));

    if (args.out) {
      fs.mkdirSync(path.dirname(path.resolve(args.out)), {recursive: true});
      await page.emulateMedia({media: "print"});
      await page.pdf({path: args.out, preferCSSPageSize: true, printBackground: true});
      await page.emulateMedia({media: "screen"});
      console.log(`Wrote ${args.out}`);
    }

    if (args.pngDir) {
      fs.mkdirSync(args.pngDir, {recursive: true});
      const pages = await page.$$(args.spreads ? ".spread" : ".page");
      const [from, to] = args.pages ?? [1, pages.length];
      for (let i = from - 1; i < Math.min(to, pages.length); i++) {
        const file = path.join(args.pngDir, `page-${String(i + 1).padStart(3, "0")}.png`);
        // Sequential on purpose: screenshots of the same page can't run concurrently.
        // eslint-disable-next-line no-await-in-loop
        await pages[i].screenshot({path: file});
      }
      console.log(`Wrote ${Math.min(to, pages.length) - from + 1} PNGs to ${args.pngDir}`);
    }
  } finally {
    await browser.close();
    server?.close();
  }
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
