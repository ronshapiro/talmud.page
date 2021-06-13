/* eslint no-console: "off" */
import * as chalk from 'chalk';
import * as Bundler from 'parcel-bundler';
import * as fs from 'fs';
import {spawn, execSync, ChildProcess} from "child_process";

const ls = (dir: string): string[] => {
  return fs.readdirSync(dir).map(x => `${dir}/${x}`);
};

if (fs.existsSync("./dist")) {
  for (const file of ls("./dist")) {
    fs.unlinkSync(file);
  }
}

const entryFiles = [
  "./templates/daf_yomi_redirector.html",
  "./templates/homepage.html",
  "./templates/notes_redirecter.html",
  "./templates/preferences.html",
  "./templates/talmud_page.html",
  "./templates/tanakh.html",
  "./templates/service_worker.html",
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

bundler.on("bundled", () => {
  const distFiles = new Set(fs.readdirSync("./dist"));
  for (const template of fs.readdirSync("./templates")) {
    if (!distFiles.has(template)) {
      fs.copyFileSync(`./templates/${template}`, `./dist/${template}`);
    }
  }
});

bundler.bundle();

const IGNORED_PREFIXES = [
  ".#",
  ".eslintrc.js",
  ".git/",
  "cached_outputs/",
  "dist/",
  "test_data/",
  "venv/",
];
const ignoreFile = (file: string) => (
  IGNORED_PREFIXES.some(x => file.startsWith(x)) || file.includes("#")
);

const jsFiles = (dir = "."): string[] => {
  const files: string[] = [];
  for (const x of fs.readdirSync(dir, {withFileTypes: true})) {
    const name = dir === "." ? x.name : `${dir}/${x.name}`;
    if (ignoreFile(name) || name === "node_modules") {
      continue;
    }

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

const FOUND_ERRORS_RE = (
  /\[.*\d?\d:\d{2}:\d{2} [AP]M.*] (Found (\d+) errors?. Watching for file changes.)$/
);
function processTscOutput(output: string) {
  if (output.includes("File change detected")
    || output.includes("Starting compilation in watch mode")
    // File not found
    || output.includes("TS6053")) {
    return;
  }

  const match = output.match(FOUND_ERRORS_RE);
  if (match) {
    if (match[2] === "0") {
      console.log(chalk.blue("[ clean ] tsc"));
    }
  } else {
    console.log(output);
  }
}

if (!isProd) {
  const tscProcess = spawn("npx", ["tsc", "--watch", "--preserveWatchOutput"]);
  tscProcess.stdout!.on("data", data => processTscOutput(data.toString().trim()));
  tscProcess.stderr!.on("data", data => processTscOutput(data.toString().trim()));

  let eslint: ChildProcess | undefined;
  const startEslint = () => {
    const allJsFiles = jsFiles(".");
    const needToSave = allJsFiles.filter(x => x.includes(".#"));
    if (needToSave.length > 0) {
      console.log(chalk.bgMagenta.bold(`Unsaved: ${needToSave}`));
    }
    const filesToLint = allJsFiles.filter(x => !x.includes(".#"));

    eslint?.kill();
    eslint = spawn("pre-commit/check_eslint.sh", filesToLint);
    eslint.stdout!.on("data", data => console.log(data.toString()));
    eslint.stderr!.on("data", data => console.error(chalk.bgRed(data.toString())));
    eslint.on("close", code => {
      if (code === 0) {
        console.log(chalk.blue("[ clean ] eslint"));
      }
    });
  };

  startEslint();
  fs.watch(".", {recursive: true}, (changeType, file) => {
    if (!ignoreFile(file) && /.*\.[jt]sx?$/.test(file)) {
      startEslint();
    }
  });

  let serverProcess: ChildProcess | undefined;

  const killServer = () => serverProcess?.kill();
  const startServer = () => {
    killServer();
    const otherProcesses = execSync(
      "ps ax | grep 'ts-node express_main.ts'").toString().split("\n");
    for (const toKill of otherProcesses) {
      if (toKill.includes("node_modules/.bin/ts-node")) {
        const process = toKill.match(/^(\d+) .*/)![1];
        execSync(`kill ${process}`);
      }
    }

    serverProcess = spawn("npx", [
      "nodemon express_main.ts",
      "--config nodemon-express.json",
      "--ignore parcel.ts",
      "--ignore cached_outputs",
      "--ignore test_data",
      "--ignore js",
    ].flatMap(x => x.split(" ")), {
      env: {
        ...process.env,
        PORT: "5000",
      },
    });
    serverProcess.stdout!.on("data", data => console.log(data.toString().trim()));
    serverProcess.stderr!.on("data", data => console.log(data.toString().trim()));
    process.stdin.pipe(serverProcess.stdin!);
  };

  let distFiles = new Set();
  bundler.on('bundled', () => {
    const newDistFiles = fs.readdirSync("./dist");
    if (distFiles.size !== newDistFiles.length || !newDistFiles.every(x => distFiles.has(x))) {
      distFiles = new Set(newDistFiles);
      startServer();
    }
  });

  bundler.on("buildError", () => killServer());
  process.on("exit", () => killServer());
}
