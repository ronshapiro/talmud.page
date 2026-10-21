import * as fs from "fs";
import * as path from "path";
import {renderPrompt} from "./prompt_template";

const NAME = "__prompt_template_test__.md";
const filePath = path.join(__dirname, "prompts", NAME);

afterEach(() => {
  fs.rmSync(filePath, {force: true});
});

function writeTemplate(text: string): void {
  fs.writeFileSync(filePath, text);
}

test("fills placeholders, drops empty placeholder-only lines, and strips the leading comment", () => {
  writeTemplate("<!--\ndocs\n-->\n# Title\n\nHello {{name}}.\n{{optional}}\n\n\n{{list}}\nEnd\n");
  expect(renderPrompt(NAME, {name: "world", optional: undefined, list: "a\nb"}))
    .toBe("# Title\n\nHello world.\n\na\nb\nEnd");
});

test("throws on a placeholder with no value", () => {
  writeTemplate("Hello {{name}}");
  expect(() => renderPrompt(NAME, {})).toThrow(/no value given for {{name}}/);
});

test("throws on a param the template doesn't use", () => {
  writeTemplate("Hello");
  expect(() => renderPrompt(NAME, {extra: "x"})).toThrow(/unused params extra/);
});

test("doesn't re-expand placeholder syntax inside values", () => {
  writeTemplate("{{a}}");
  expect(renderPrompt(NAME, {a: "{{b}}"})).toBe("{{b}}");
});
