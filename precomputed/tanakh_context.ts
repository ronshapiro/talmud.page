import {ApiResponse} from "../apiTypes";
import {books} from "../books";
import {readUtf8} from "../files";
import {RealRequestMaker} from "../request_makers";
import {writeJson} from "../util/json_files";

function* bibleChapters(): Generator<ApiResponse> {
  for (const book of Object.values(books.byCanonicalName)) {
    if (!book.isBibleBook()) continue;
    for (let chapter = 1; true; chapter += 1) {
      try {
        const path = `cached_outputs/api_request_handler/${book.canonicalName}.${chapter}.json`;
        yield JSON.parse(readUtf8(path)) as ApiResponse;
      } catch (e: any) {
        if (e.code === "ENOENT") break;
        throw e;
      }
    }
  }
}

function primacy(topic: any): number {
  return Math.max(
    topic.order.curatedPrimacy?.en ?? Number.MIN_SAFE_INTEGER,
    topic.order.curatedPrimacy?.he ?? Number.MIN_SAFE_INTEGER);
}

async function main() {
  const result: Record<string, any> = {};

  const chapters = bibleChapters();
  const promises: Promise<any>[] = [];
  async function runNext(): Promise<any> {
    const {value: chapter, done} = chapters.next();
    if (done) return undefined;
    for (const ref of chapter.sections.map(x => x.ref)) {
      const processedTopics: any[] = [];
      result[ref] = processedTopics;
      // eslint-disable-next-line no-await-in-loop
      const topics = await new RealRequestMaker().makeRequest<any[]>(`/ref-topic-links/${ref}`);
      topics.sort((x, y) => primacy(y) - primacy(x));
      for (const topic of topics) {
        if (topic.dataSource.slug === "sefaria-users") continue;
        if (!topic.descriptions) continue;
        processedTopics.push({
          english: topic.descriptions.en?.prompt,
          hebrew: topic.descriptions.he?.prompt,
          sourceRef: topic.descriptions.en?.title,
          sourceHeRef: topic.descriptions.he?.title,
        });
      }
    }
    return runNext();
  }
  for (let i = 0; i < 100; i++) {
    promises.push(Promise.resolve("").then(runNext));
  }
  await Promise.all(promises);

  writeJson("precomputed/tanakh_contexts.json", result);
}
main();
