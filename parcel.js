const Bundler = require('parcel-bundler');
const fs = require('fs');

for (const file of fs.readdirSync("./dist")) {
  fs.unlinkSync(`./dist/${file}`);
}

const entryFiles = [
  './templates/preferences_page.html',
  './templates/talmud_page.html'
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

if (!isProd) {
  let flask_subprocess = undefined;
  const { spawn } = require('child_process');
  bundler.on('bundled', (bundle) => {
    if (flask_subprocess) {
      flask_subprocess.kill();
    }
    flask_subprocess = spawn('./venv/bin/python3', ["server.py"], {
      env: {
        "FLASK_ENV": "development",
      },
    });
    flask_subprocess.stdout.on('data', (data) => process.stdout.write(data));
    flask_subprocess.stderr.on('data', (data) => process.stderr.write(data));
  });
}

bundler.bundle();
