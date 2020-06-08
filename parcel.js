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

const isProd = function() {
  switch (process.argv[2]) {
    case "prod":
      return true;
    case "dev":
      return false;
    case undefined:
      throw `No configuration specified. Usage: \`node ${process.argv[1]} <prod|dev>\``;
  }
  throw `Unknown configuration: ${process.argv[2]}`;
}();

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
  flaskSubprocess = spawn("./venv/bin/python3", ["server.py"], {
    env: {
      "FLASK_ENV": "development",
    },
  });
  flaskSubprocess.stdout.on("data", (data) => process.stdout.write(data));
  flaskSubprocess.stderr.on("data", (data) => process.stderr.write(data));
  flaskSubprocess.on("exit", () => flaskDied = true);
};

if (!isProd) {
  let distFiles = new Set();
  bundler.on('bundled', (bundle) => {
    const newDistFiles = fs.readdirSync("./dist");
    if (distFiles.size !== newDistFiles.length || !newDistFiles.every(x => distFiles.has(x))) {
      distFiles = new Set(newDistFiles);
      startFlask();
    } else if (flaskDied) {
      startFlask();
    }
  });
  bundler.on("buildError", error => {
    if (flaskSubprocess) {
      flaskSubprocess.kill();
    }
  });
  fs.watch(".", {recursive: true}, (eventType, fileName) => {
    if (flaskDied && fileName.endsWith(".py")) {
      startFlask();
    }
  });
}

bundler.bundle();
