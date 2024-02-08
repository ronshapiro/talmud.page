import * as DOMPurify from "dompurify";

export function sanitizeHtmlHelper(text: string, purify: DOMPurify.DOMPurifyI): string {
  return purify.sanitize(text, {ALLOWED_TAGS: []});
}
