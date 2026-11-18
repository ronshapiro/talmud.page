/* eslint-disable no-console */
import * as fs from "fs";
import {Amud} from "../apiTypes";
import {books} from "../books";
import {cachedOutputFilePath} from "../cached_outputs";
import {readUtf8} from "../files";
import {writeJson} from "../util/json_files";
import {
  extractPageCommentaryIndex,
  PageCommentaryIndex,
} from "./translation_progress_data";

export {extractPageCommentaryIndex, PageCommentaryIndex};

export function generateRashiTosafotCommentsPerPage(): Record<string, PageCommentaryIndex> {
  const result: Record<string, PageCommentaryIndex> = {};

  for (const book of books.allBooks) {
    if (!book.isTalmud()) {
      continue;
    }

    for (const section of Array.from(book.sections)) {
      const pageRef = `${book.canonicalName} ${section}`;
      const filePath = cachedOutputFilePath(book, section);
      if (!fs.existsSync(filePath)) {
        result[pageRef] = {refs: []};
        continue;
      }

      try {
        const amudData = JSON.parse(readUtf8(filePath)) as Amud;
        result[pageRef] = extractPageCommentaryIndex(amudData);
      } catch (error) {
        console.error(`Failed to process ${pageRef}: ${error}`);
        result[pageRef] = {refs: []};
      }
    }
  }

  return result;
}

if (require.main === module) {
  console.log("Generating precomputed/rashiTosafotCommentsPerPage.json...");
  const commentaryIndex = generateRashiTosafotCommentsPerPage();
  writeJson("precomputed/rashiTosafotCommentsPerPage.json", commentaryIndex);
  console.log(`Saved commentary index for ${Object.keys(commentaryIndex).length} pages.`);
}
