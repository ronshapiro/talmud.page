/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": true}] */
/* eslint no-console: "off" */
import * as chalk from 'chalk';
import * as http from "http";
import * as Bundler from 'parcel-bundler';
import * as fs from 'fs';
import {spawn, ChildProcess} from "child_process";
import {expressMain} from "./express";

const ls = (dir: string): string[] => {
  return fs.readdirSync(dir).map(x => `${dir}/${x}`);
};

const IGNORE_FILES = new Set(["node_modules", "venv", "__pycache__", "dist", ".eslintrc.js"]);

const jsFiles = (dir: string): string[] => {
  const files: string[] = [];
  for (const x of fs.readdirSync(dir, {withFileTypes: true})) {
    if (IGNORE_FILES.has(x.name)) continue;

    const name = dir === "." ? x.name : `${dir}/${x.name}`;
    if (x.isDirectory()) {
      files.push(...jsFiles(name));
    } else if (name.endsWith(".js")
      || name.endsWith(".ts")
      || name.endsWith(".jsx")
      || name.endsWith(".tsx")) {
      files.push(name);
    }
  }
  return files;
};

if (fs.existsSync("./dist")) {
  for (const file of ls("./dist")) {
    fs.unlinkSync(file);
  }
}

const entryFiles = [
  './templates/daf_yomi_redirector.html',
  './templates/homepage.html',
  './templates/notes_redirecter.html',
  './templates/preferences.html',
  './templates/talmud_page.html',
  './templates/tanakh.html',
];

const isProd = (() => {
  switch (process.argv[2]) {
    case "prod":
      return true;
    case "dev":
      return false;
    case undefined:
    default:
      throw new Error(`No configuration specified. Usage: \`node ${process.argv[1]} <prod|dev>\``);
  }
})();

const bundler = new Bundler(entryFiles, {
  watch: !isProd,
  minify: isProd,
  hmr: false,
  // @ts-ignore
  autoInstall: false,
  contentHash: isProd,
  scopeHoist: isProd,
});

let server: http.Server | undefined;

const killServer = () => server?.close();
const startServer = () => {
  killServer();
  server = expressMain(5000);
};

if (!isProd) {
  let distFiles = new Set();
  const compilerSubprocesses: ChildProcess[] = [];
  bundler.on('bundled', () => {
    const newDistFiles = fs.readdirSync("./dist");
    if (distFiles.size !== newDistFiles.length || !newDistFiles.every(x => distFiles.has(x))) {
      distFiles = new Set(newDistFiles);
      startServer();
    }
    for (const template of fs.readdirSync("./templates")) {
      if (!distFiles.has(template)) {
        fs.copyFileSync(`./templates/${template}`, `./dist/${template}`);
      }
    }

    while (compilerSubprocesses.length > 0) {
      compilerSubprocesses.pop()!.kill();
    }
    const subprocessOutputs: boolean[] = [];
    const processOutput = (process: ChildProcess) => {
      const index = compilerSubprocesses.length;
      compilerSubprocesses[index] = process;
      const lines: string[] = [];
      process.stdout!.on("data", data => lines.push(data));
      process.stderr!.on("data", data => lines.push(chalk.bgRed(data)));
      process.on("close", () => {
        if (lines.length > 0) {
          console.log(lines.join("\n"));
          subprocessOutputs.push(true);
        } else {
          subprocessOutputs.push(false);
        }

        if (subprocessOutputs.length === compilerSubprocesses.length
            && subprocessOutputs.every(x => !x)) {
          console.log(chalk.green.bold("    js/ts is clean!"));
        }
      });
    };

    const allJsFiles = jsFiles(".");
    const needToSave = allJsFiles.filter(x => x.indexOf(".#") !== -1);
    if (needToSave.length > 0) {
      console.log(chalk.bgMagenta.bold(`Unsaved: ${needToSave}`));
    }
    const filesToLint = allJsFiles.filter(x => x.indexOf(".#") === -1);
    const tsFiles = filesToLint.filter(x => x.endsWith(".ts") || x.endsWith(".tsx"));

    if (tsFiles.length > 0) {
      processOutput(spawn("pre-commit/tsc.sh", tsFiles));
    }

    processOutput(spawn("pre-commit/check_eslint.sh", filesToLint));
  });

  bundler.on("buildError", () => killServer());
  process.on("exit", () => killServer());
}

bundler.bundle();
