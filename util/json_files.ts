import * as fs from "fs";
import {jsonStringify} from "./json_stringify";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function writeJson(fileName: string, data: any): void {
  fs.writeFileSync(fileName, jsonStringify(data));
}
