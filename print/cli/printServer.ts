/* eslint-disable no-console */
// A minimal server for the print layouts: builds templates/print.html with Parcel and serves it
// together with the /api/print data routes. Used by the offline PDF renderer, and handy for working
// on the print layouts without the full app:
//
//   npx ts-node print/cli/printServer.ts [--port 5002] [--watch] [--offline]

import * as express from "express";
import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import {registerPrintRoutes} from "../server/routes";
import {setOfflineMode} from "../server/printData";

const ROOT = path.join(__dirname, "..", "..");
export const PRINT_DIST = path.join(ROOT, "print", ".dist");

export async function buildPrintBundle(watch = false): Promise<void> {
  // Imported lazily: parcel-bundler is slow to load.
  // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
  const Bundler = require("parcel-bundler");
  const bundler = new Bundler([path.join(ROOT, "templates", "print.html")], {
    outDir: PRINT_DIST,
    publicUrl: "/",
    watch,
    minify: false,
    hmr: false,
    autoInstall: false,
    logLevel: 2,
    sourceMaps: true,
    scopeHoist: false,
  });
  await bundler.bundle();
}

export function startPrintServer(port: number): Promise<http.Server> {
  const app = express();
  registerPrintRoutes(app, res => res.sendFile(path.join(PRINT_DIST, "print.html")));
  app.use(express.static(PRINT_DIST, {index: false}));
  return new Promise(resolve => {
    const server = app.listen(port, () => resolve(server));
  });
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf("--port");
  const port = portIndex === -1 ? 5002 : parseInt(args[portIndex + 1]);
  if (args.includes("--offline")) setOfflineMode(true);
  (async () => {
    if (!args.includes("--no-build")) {
      await buildPrintBundle(args.includes("--watch"));
    }
    if (!fs.existsSync(path.join(PRINT_DIST, "print.html"))) {
      throw new Error("Build failed: print.html missing");
    }
    await startPrintServer(port);
    console.log(`Print server: http://localhost:${port}/print`);
  })();
}
