// The primary goal of this script is to run the custom precommits in parallel. pre-commit by
// default runs precommits sequentially to avoid inter-precommit dependencies since pre-commits can
// modify files. For most pre-commits, that's a bad idea anyway.

/* eslint no-console: "off" */
import * as chalk from 'chalk';
import * as fs from 'fs';
import {ChildProcess, spawn} from "child_process";

const precommits: ChildProcess[] = [];
const exitCodes: number[] = [];

let filesFromPath: string | undefined;
const filesFromIdx = process.argv.indexOf("--files-from");
if (filesFromIdx !== -1 && process.argv[filesFromIdx + 1]) {
  filesFromPath = process.argv[filesFromIdx + 1];
}

let tempFileList: string | undefined;
if (!filesFromPath) {
  const dashDashIdx = process.argv.indexOf("--");
  const positionalFiles = dashDashIdx !== -1 ? process.argv.slice(dashDashIdx + 1) : [];
  if (positionalFiles.length > 0) {
    tempFileList = `/tmp/precommit_files_${process.pid}_${Date.now()}.txt`;
    fs.writeFileSync(tempFileList, positionalFiles.join("\n") + "\n");
    filesFromPath = tempFileList;
  }
}

const cleanup = () => {
  if (tempFileList && fs.existsSync(tempFileList)) {
    try {
      fs.unlinkSync(tempFileList);
    } catch {
      // ignore
    }
  }
};
process.on("exit", cleanup);

const FILE_ACCEPTING_CHECKS = new Set([
  "check_do_not_submit.py",
  "check_eslint.sh",
  "check_google_doc_json_file_name.py",
]);

const precommit = (scriptName: string) => {
  const command = `pre-commit/${scriptName}`;
  const args: string[] = [];
  if (FILE_ACCEPTING_CHECKS.has(scriptName) && filesFromPath) {
    args.push("--files-from", filesFromPath);
  }
  const proc = spawn(command, args);
  precommits.push(proc);
  const output: string[] = [];
  const collectOutput = (data: any) => {
    output.push(String(data));
  };
  proc.stdout.on("data", collectOutput);
  proc.stderr.on("data", collectOutput);
  proc.on("error", (err: any) => {
    console.error(chalk.red.inverse(`Error spawning ${command}: ${err}`));
    exitCodes.push(1);
    if (precommits.length === exitCodes.length) {
      const finalCode = exitCodes.reduce((x, y) => x + y, 0);
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(finalCode);
    }
  });
  proc.on("exit", (exitCode: number | null, signal: string | null) => {
    const code = exitCode !== null ? exitCode : (signal ? 1 : 0);
    exitCodes.push(code);
    if (code !== 0) {
      console.log(chalk.red.inverse(`${command} failed (code=${exitCode}, signal=${signal})`));
      if (output.length > 0) {
        console.log(output.join(""));
      }
    }
    if (precommits.length === exitCodes.length) {
      const finalCode = exitCodes.reduce((x, y) => x + y, 0);
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(finalCode);
    }
  });
};

for (const file of fs.readdirSync("pre-commit")) {
  if (file !== "custom.sh" && file !== "pre-commit.ts") {
    precommit(file);
  }
}
