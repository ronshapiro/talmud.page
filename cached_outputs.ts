import {Book} from "./books";

export function cachedOutputFilePath(book: Book, section: string): string {
  return `cached_outputs/api_request_handler/${book.canonicalName}.${section}.json`;
}
