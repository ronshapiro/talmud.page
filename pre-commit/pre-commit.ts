// The primary goal of this script is to run the custom precommits in parallel. pre-commit by
// default runs precommits sequentially to avoid inter-precommit dependencies since pre-commits can
// modify files. For most pre-commits, that's a bad idea anyway.

/* eslint no-console: "off" */
import * as chalk from 'chalk';
import * as fs from 'fs';
import {ChildProcess, spawn} from "child_process";

const precommits: ChildProcess[] = [];
const exitCodes: number[] = [];

const files = process.argv.slice(process.argv.indexOf("--") + 1);

const logSync = (msg: string) => {
  fs.writeSync(2, `${msg}\n`);
};

const precommit = (command: string) => {
  logSync(`[pre-commit.ts] Spawning ${command} with ${files.length} file args`);
  const proc = spawn(command, files);
  precommits.push(proc);
  const output: string[] = [];
  const collectOutput = (data: any) => {
    output.push(String(data));
  };
  proc.stdout.on("data", collectOutput);
  proc.stderr.on("data", collectOutput);
  proc.on("error", (err: any) => {
    const errorDetails = err && err.stack ? err.stack : String(err);
    logSync(`[pre-commit.ts] ERROR spawning ${command}: ${errorDetails}`);
    exitCodes.push(1);
    if (precommits.length === exitCodes.length) {
      const finalCode = exitCodes.reduce((x, y) => x + y, 0);
      logSync(`[pre-commit.ts] All ${precommits.length} checks completed. Final exit code: ${finalCode}`);
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(finalCode);
    }
  });
  proc.on("exit", (exitCode: number | null, signal: string | null) => {
    const code = exitCode !== null ? exitCode : (signal ? 1 : 0);
    logSync(`[pre-commit.ts] ${command} exit: code=${exitCode}, signal=${signal}`);
    exitCodes.push(code);
    if (code !== 0) {
      logSync(chalk.red.inverse(`${command} failed (code=${exitCode}, signal=${signal})`));
      if (output.length > 0) {
        logSync(output.join(""));
      }
    }
    if (precommits.length === exitCodes.length) {
      const finalCode = exitCodes.reduce((x, y) => x + y, 0);
      logSync(`[pre-commit.ts] All ${precommits.length} checks completed. Final exit code: ${finalCode}`);
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(finalCode);
    }
  });
};

for (const file of fs.readdirSync("pre-commit")) {
  if (file !== "custom.sh" && file !== "pre-commit.ts") {
    precommit(`pre-commit/${file}`);
  }
}
