/* eslint-disable no-console */
import {Amud, ApiComment} from "./apiTypes";
import {books} from "./books";
import {cachedOutputFilePath} from "./cached_outputs";
import {ListMultimap} from "./multimap";
import {readUtf8} from "./files";
import {splitOnBookName} from "./refs";

function flatten(textType: sefaria.TextType): string | undefined {
  if (!textType) return undefined;
  if (typeof textType === "string") {
    return textType;
  }
  return textType.flat(Infinity).join("\n");
}

function skipRef(ref: string): boolean {
  if (ref.startsWith("Footnote")
    || ref.startsWith("Otzar Laazei Rashi")) {
    return true;
  }

  const book = books.byCanonicalName[splitOnBookName(ref)[0]];
  return book && book.isBibleBook();
}

for (const book of Array.from(new Set(Object.values(books.byCanonicalName)))) {
  if (!book.isTalmud() && !book.isBibleBook()) continue;
  if (book.canonicalName === "Shekalim") continue;

  for (const section of Array.from(book.sections)) {
    const filePath = cachedOutputFilePath(book, section);
    const amud = JSON.parse(readUtf8(filePath)) as Amud;
    const dupes = new ListMultimap<string, ApiComment>();
    const visitHasCommentary = (hasCommentary: any) => {
      if (!hasCommentary.commentary) return;
      const comments: ApiComment[] = (
        Object.values(hasCommentary.commentary).flatMap((c: any) => c.comments));
      for (const comment of comments) {
        if (skipRef(comment.ref)) continue;

        const text = flatten(comment.he);
        // TODO: check for dupes by removing all puncutation also
        if (text && text !== "") {
          dupes.put(text, comment);
        }
        visitHasCommentary(comment);
      }
    };
    amud.sections.forEach(visitHasCommentary);

    dupes.asMap().forEach((comments: ApiComment[], dupeText: string) => {
      const refs = comments.map(c => c.ref);
      const refSet = new Set(refs);
      if (refSet.size > 1) {
        console.log("MATCH", refSet, dupeText);
      }
    });
  }
}
