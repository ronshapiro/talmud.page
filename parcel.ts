/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": true}] */
/* eslint no-console: "off" */
import * as chalk from 'chalk';
import * as Bundler from 'parcel-bundler';
import * as fs from 'fs';
import {spawn, ChildProcess} from "child_process";
// @ts-ignore
import * as multiplexerApp from "./sefaria-multiplexer/core";

const ls = (dir: string): string[] => {
  return fs.readdirSync(dir).map(x => `${dir}/${x}`);
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

let flaskSubprocess: ChildProcess | undefined;
let flaskDied = false;
const startFlask = () => {
  flaskDied = false;
  if (flaskSubprocess) {
    flaskSubprocess.kill();
  }
  flaskSubprocess = spawn("./venv/bin/python3", [
    "-u", // Force unbuffered outputs for stdout and stderr so that outputs are visible immediately
    "server.py",
  ], {
    env: {
      FLASK_ENV: "development",
      TANAKH_BASE_URL: process.env.TANAKH_BASE_URL || "http://localhost:3000",
    },
  });
  flaskSubprocess.stdout!.pipe(process.stdout);
  flaskSubprocess.stderr!.pipe(process.stderr);
  flaskSubprocess.on("exit", () => {
    flaskDied = true;
  });
};
const killFlask = () => {
  if (flaskSubprocess) {
    flaskSubprocess.kill();
  }
};

if (!isProd) {
  if (!process.env.TANAKH_BASE_URL) {
    multiplexerApp.listen();
  }

  let distFiles = new Set();
  const compilerSubprocesses: ChildProcess[] = [];
  bundler.on('bundled', () => {
    const newDistFiles = fs.readdirSync("./dist");
    if (distFiles.size !== newDistFiles.length || !newDistFiles.every(x => distFiles.has(x))) {
      distFiles = new Set(newDistFiles);
      startFlask();
    } else if (flaskDied) {
      startFlask();
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

    const allJsFiles = ls("js").concat(ls("js/google_drive"));
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

  bundler.on("buildError", () => killFlask());
  process.on("exit", () => killFlask());

  fs.watch(".", {recursive: true}, (eventType, fileName) => {
    if (flaskDied
        && fileName.endsWith(".py")
        && !fileName.startsWith(".#")
        && !fileName.startsWith("#")) {
      startFlask();
    }
  });
}

bundler.bundle();
