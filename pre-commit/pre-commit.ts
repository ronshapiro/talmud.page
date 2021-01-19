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

const precommit = (command: string) => {
  const proc = spawn(command, files);
  precommits.push(proc);
  const output: string[] = [];
  const collectOutput = (data: any) => {
    output.push(String(data).trim());
  };
  proc.stdout.on("data", collectOutput);
  proc.stderr.on("data", collectOutput);
  proc.on("exit", (exitCode: number) => {
    exitCodes.push(exitCode);
    if (exitCode !== 0) {
      console.log(chalk.red.inverse(`${command} failed`));
      if (output.length > 0) {
        console.log(output.join("\n"));
      }
    }
    if (precommits.length === exitCodes.length) {
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(exitCodes.reduce((x, y) => x + y));
    }
  });
};

for (const file of fs.readdirSync("pre-commit")) {
  if (file !== "custom.sh" && file !== "pre-commit.ts") {
    precommit(`pre-commit/${file}`);
  }
}
