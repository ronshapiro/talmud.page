import * as fs from "fs";
import * as path from "path";
import {readUtf8} from "../files";

const PROMPTS_DIR = path.join(__dirname, "prompts");
const PLACEHOLDER = /{{(\w+)}}/g;
const SOLE_PLACEHOLDER = /^{{(\w+)}}$/;
const LEADING_COMMENT = /^<!--[\S\s]*?-->\s*/;

function loadTemplate(name: string): string {
  const filePath = path.join(PROMPTS_DIR, name);
  if (!fs.existsSync(filePath)) throw new Error(`No prompt template at ${filePath}`);
  return readUtf8(filePath).replace(LEADING_COMMENT, "");
}

/**
 * Renders rsi_orchestrator/prompts/<name>, replacing each `{{param}}` with its value. A line that
 * is only a placeholder whose value is empty or undefined is dropped, so optional sections leave
 * no gap. A leading `<!-- ... -->` comment documents the template and is not sent. Every param
 * must be used and every placeholder must be given, so templates and callers can't drift apart.
 */
export function renderPrompt(name: string, params: Record<string, string | undefined>): string {
  const used = new Set<string>();
  const valueOf = (param: string): string => {
    if (!(param in params)) throw new Error(`${name}: no value given for {{${param}}}`);
    used.add(param);
    return params[param] ?? "";
  };
  const lines = loadTemplate(name).split("\n").flatMap(line => {
    const sole = SOLE_PLACEHOLDER.exec(line.trim());
    if (sole && !valueOf(sole[1])) return [];
    return [line.replace(PLACEHOLDER, (_, param: string) => valueOf(param))];
  });
  const unused = Object.keys(params).filter(param => !used.has(param));
  if (unused.length > 0) throw new Error(`${name}: unused params ${unused.join(", ")}`);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
