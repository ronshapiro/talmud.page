import * as yargs from "yargs";
import {hideBin} from "yargs/helpers";
import {getNeighborSegments, getPriorSugyaSkeleton, getRefs} from "./context_fetch";

/**
 * CLI entrypoint for context_fetch.ts, invoked by a headless task-type call via
 * `--allowedTools "Bash(npx ts-node rsi_orchestrator/context_fetch_cli.ts *)"`. Uses yargs, same
 * as rashi_tosafot_translation_cli.ts — this file is never imported by a test (yargs is ESM-only
 * and breaks under jest), so it's fine for it to depend on yargs directly; the core module stays
 * jest-safe. Output is compact JSON on stdout, since it's read back into the calling agent's own
 * context.
 */
async function main(): Promise<void> {
  await yargs(hideBin(process.argv))
    .command(
      "get-refs <refsJson>",
      "Fetch specific refs' Hebrew/English text",
      y => y.positional("refsJson", {
        type: "string",
        demandOption: true,
        describe: 'JSON array of ref strings, e.g. \'["ref1", "ref2"]\'',
      }),
      argv => {
        let refs: string[];
        try {
          refs = JSON.parse(argv.refsJson) as string[];
        } catch {
          console.error("get-refs argument must be a JSON array of ref strings");
          process.exitCode = 1;
          return;
        }
        console.log(JSON.stringify(getRefs(refs)));
      },
    )
    .command(
      "get-neighbors <ref>",
      "Fetch the Gemara segments immediately before/after a given segment ref",
      y => y
        .positional("ref", {type: "string", demandOption: true})
        .options({
          before: {type: "number", default: 1, describe: "segments to include before ref"},
          after: {type: "number", default: 1, describe: "segments to include after ref"},
        }),
      argv => {
        console.log(JSON.stringify(getNeighborSegments(argv.ref, argv.before, argv.after)));
      },
    )
    .command(
      "get-prior-sugyot <ref>",
      "Fetch ref-range metadata (not full text) for the sugyot immediately before ref's page",
      y => y
        .positional("ref", {type: "string", demandOption: true})
        .options({count: {type: "number", default: 2, describe: "how many prior sugyot"}}),
      argv => {
        console.log(JSON.stringify(getPriorSugyaSkeleton(argv.ref, argv.count)));
      },
    )
    .demandCommand(1)
    .strict()
    .parseAsync();
}

main().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
