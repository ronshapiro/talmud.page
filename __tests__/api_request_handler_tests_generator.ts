import * as fs from "fs";
import {testPages} from "./api_request_handler_base";

const titles = new Set();
for (const page of testPages) {
  if (titles.has(page.title)) {
    continue;
  }
  titles.add(page.title);
  fs.writeFileSync(`__tests__/${page.title.replace(/ /g, "_")}.test.ts`, `import {testTitle} from "./api_request_handler_tester";

testTitle("${page.title}");
`);
}
