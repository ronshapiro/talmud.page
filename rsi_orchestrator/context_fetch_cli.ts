import {getNeighborSegments, getPriorSugyaSkeleton, getRefs} from "./context_fetch";

/**
 * CLI entrypoint for context_fetch.ts, invoked by a headless task-type call via
 * `--allowedTools "Bash(npx ts-node rsi_orchestrator/context_fetch_cli.ts *)"`. Deliberately not
 * using yargs here (unlike rashi_tosafot_translation_cli.ts) — this gets invoked many times per
 * generation call, so keeping it a plain, fast-starting script matters more than for the
 * once-per-run orchestrator CLI. Output is compact JSON on stdout, since it's read back into the
 * calling agent's own context.
 */

function usage(): void {
  console.error(
    "Usage:\n"
    + "  context_fetch_cli.ts get-refs '[\"ref1\", \"ref2\"]'\n"
    + "  context_fetch_cli.ts get-neighbors <ref> [--before N] [--after N]\n"
    + "  context_fetch_cli.ts get-prior-sugyot <ref> [--count N]");
  process.exitCode = 1;
}

function flagValue(args: string[], name: string, fallback: number): number {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index === args.length - 1) return fallback;
  const value = Number(args[index + 1]);
  return Number.isFinite(value) ? value : fallback;
}

function main(): void {
  const [command, ...rest] = process.argv.slice(2);
  switch (command) {
    case "get-refs": {
      if (!rest[0]) { usage(); return; }
      let refs: string[];
      try {
        refs = JSON.parse(rest[0]) as string[];
      } catch {
        console.error("get-refs argument must be a JSON array of ref strings");
        process.exitCode = 1;
        return;
      }
      console.log(JSON.stringify(getRefs(refs)));
      return;
    }
    case "get-neighbors": {
      if (!rest[0]) { usage(); return; }
      console.log(JSON.stringify(getNeighborSegments(
        rest[0], flagValue(rest, "before", 1), flagValue(rest, "after", 1))));
      return;
    }
    case "get-prior-sugyot": {
      if (!rest[0]) { usage(); return; }
      console.log(JSON.stringify(getPriorSugyaSkeleton(rest[0], flagValue(rest, "count", 2))));
      return;
    }
    default:
      usage();
  }
}

main();
