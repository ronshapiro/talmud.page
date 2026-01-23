/* eslint no-console: "off" */
import * as chalk from 'chalk';
import * as fs from 'fs';
import { spawn, ChildProcess } from "child_process";

// Helper to ignore files
const IGNORED_PREFIXES = [
  ".#",
  ".eslintrc.js",
  ".eslintrc.dev.js",
  ".git/",
  "cached_outputs/",
  "dist/",
  "test_data/",
  "venv/",
  "scripts/", // Ignore scripts folder
  "js/", // Ignore frontend code (Vite handles it)
];
const ignoreFile = (file: string) => (
  IGNORED_PREFIXES.some(x => file.startsWith(x)) || file.includes("#")
);

const jsFiles = (dir = "."): string[] => {
  const files: string[] = [];
  try {
    for (const x of fs.readdirSync(dir, { withFileTypes: true })) {
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
  } catch (e) {
    // Ignore errors reading dirs
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

// 1. Start TSC in watch mode
console.log(chalk.yellow("Starting TSC..."));
const tscProcess = spawn("npx", ["tsc", "--watch", "--preserveWatchOutput"]);
tscProcess.stdout!.on("data", data => processTscOutput(data.toString().trim()));
tscProcess.stderr!.on("data", data => processTscOutput(data.toString().trim()));

// 2. Start ESLint
let eslint: ChildProcess | undefined;
const startEslint = () => {
  const allJsFiles = jsFiles(".");
  const needToSave = allJsFiles.filter(x => x.includes(".#"));
  if (needToSave.length > 0) {
    console.log(chalk.bgMagenta.bold(`Unsaved: ${needToSave}`));
  }
  const filesToLint = allJsFiles.filter(x => !x.includes(".#"));

  eslint?.kill();
  eslint = spawn("pre-commit/check_eslint.sh", filesToLint.concat(["--dev"]));
  eslint.stdout!.on("data", data => console.log(data.toString()));
  eslint.stderr!.on("data", data => console.error(chalk.bgRed(data.toString())));
  eslint.on("close", code => {
    if (code === 0) {
      console.log(chalk.blue("[ clean ] eslint"));
    }
  });
};

console.log(chalk.yellow("Starting ESLint..."));
startEslint();
fs.watch(".", { recursive: true }, (changeType, file) => {
  if (!ignoreFile(file) && /.*\.[jt]sx?$/.test(file)) {
    startEslint();
  }
});

// 3. Start Nodemon
console.log(chalk.yellow("Starting Nodemon (Express)..."));
const serverProcess = spawn("npx", [
  "nodemon express_main.ts",
  "--config nodemon-express.json",
  "--ignore parcel.ts",
  "--ignore scripts",
  "--ignore cached_outputs",
  "--ignore test_data",
  "--ignore js",
].flatMap(x => x.split(" ")), {
  env: {
    ...process.env,
    PORT: "5001",
    FORCE_COLOR: "true",
  },
});
serverProcess.stdout!.on("data", data => console.log(data.toString().trim()));
serverProcess.stderr!.on("data", data => console.log(data.toString().trim()));
process.stdin.pipe(serverProcess.stdin!);
