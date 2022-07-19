import * as fs from "fs";

export function readUtf8(path: string): Promise<string> {
  return fs.promises.open(path, "r")
    .then(file => {
      const text = file.readFile({encoding: "utf-8"});
      file.close();
      return text;
    });
}
