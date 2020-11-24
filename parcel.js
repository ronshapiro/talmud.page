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
  bundler.on('bundled', () => {
    const newDistFiles = fs.readdirSync("./dist");
    if (distFiles.size !== newDistFiles.length || !newDistFiles.every(x => distFiles.has(x))) {
      distFiles = new Set(newDistFiles);
      startFlask();
    } else if (flaskDied) {
      startFlask();
    }

    const jsFiles = fs.readdirSync("js").map(x => `js/${x}`);
    const eslintProc = spawn("pre-commit/check_eslint.sh", jsFiles);
    eslintProc.stdout.on("data", (data) => {
      String(data).split("\n").forEach(line => {
        if (/ +[0-9]+:[0-9]+ +warning/.test(line)) {
          line = chalk.yellow(line);
        } else if (/ +[0-9]+:[0-9]+ +error/.test(line)) {
          line = chalk.red(line);
        }
        process.stdout.write(line + "\n");
      });
    });
    eslintProc.stderr.on("data", (data) => process.stderr.write(chalk.red(data)));
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
