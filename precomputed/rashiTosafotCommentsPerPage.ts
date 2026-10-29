/* eslint-disable no-console */
import * as fs from "fs";
import {books} from "../books";
import {cachedOutputFilePath} from "../cached_outputs";
import {readUtf8} from "../files";
import {writeJson} from "../util/json_files";

export interface PageCommentaryIndex {
  refs: string[];
  sefariaTranslatedRefs?: string[];
}

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
        const amudData = JSON.parse(readUtf8(filePath));
        const refs: string[] = [];
        const sefariaTranslatedRefs: string[] = [];

        for (const segment of amudData.sections) {
          for (const commentator of ["Rashi", "Tosafot"]) {
            const comments = segment.commentary?.[commentator]?.comments ?? [];
            for (const comment of comments) {
              refs.push(comment.ref);
              if (comment.en && comment.en.length > 0) {
                sefariaTranslatedRefs.push(comment.ref);
              }
            }
          }
        }

        const pageIndex: PageCommentaryIndex = {refs};
        if (sefariaTranslatedRefs.length > 0) {
          pageIndex.sefariaTranslatedRefs = sefariaTranslatedRefs;
        }
        result[pageRef] = pageIndex;
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
