/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": true}] */
const chalk = require('chalk');
const Bundler = require('parcel-bundler');
const fs = require('fs');
const { spawn } = require("child_process");

if (fs.existsSync("./dist")) {
  for (const file of fs.readdirSync("./dist")) {
    fs.unlinkSync(`./dist/${file}`);
  }
}

const entryFiles = [
  './templates/homepage.html',
  './templates/preferences.html',
  './templates/talmud_page.html',
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
  autoInstall: false,
});

let flaskSubprocess = undefined;
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
    },
  });
  flaskSubprocess.stdout.pipe(process.stdout);
  flaskSubprocess.stderr.pipe(process.stderr);
  flaskSubprocess.on("exit", () => {
    flaskDied = true;
  });
};

if (!isProd) {
  let distFiles = new Set();
  let eslintProc;
  let lastEslintHadOutput = false;
  bundler.on('bundled', () => {
    if (eslintProc) {
      eslintProc.kill();
      eslintProc = undefined;
    }
    const newDistFiles = fs.readdirSync("./dist");
    if (distFiles.size !== newDistFiles.length || !newDistFiles.every(x => distFiles.has(x))) {
      distFiles = new Set(newDistFiles);
      startFlask();
    } else if (flaskDied) {
      startFlask();
    }

    const allJsFiles = fs.readdirSync("js");
    const needToSave = allJsFiles.filter(x => x.startsWith(".#")).map(x => `js/${x}`);
    if (needToSave.length > 0) {
      console.log(chalk.bgMagenta.bold(`Unsaved: ${needToSave}`));
    }
    const filesToLint = allJsFiles.filter(x => !x.startsWith(".#")).map(x => `js/${x}`);

    let eslintHadOutput = false;
    eslintProc = spawn("pre-commit/check_eslint.sh", filesToLint);
    eslintProc.stdout.on("data", (data) => {
      eslintHadOutput = true;
      String(data).split("\n").forEach(line => {
        if (/ +[0-9]+:[0-9]+ +warning/.test(line)) {
          line = chalk.yellow(line);
        } else if (/ +[0-9]+:[0-9]+ +error/.test(line)) {
          line = chalk.red(line);
        }
        console.log(line);
      });
    });
    eslintProc.stderr.on("data", (data) => process.stderr.write(chalk.red(data)));
    eslintProc.on("close", () => {
      if (!eslintHadOutput && lastEslintHadOutput) {
        console.log(chalk.green.bold("   eslint is green again"));
      }
      lastEslintHadOutput = eslintHadOutput;
      eslintProc = undefined;
    });
  });
  bundler.on("buildError", () => {
    if (flaskSubprocess) {
      flaskSubprocess.kill();
    }
  });
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
