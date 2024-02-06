import * as DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const purify = DOMPurify(new JSDOM().window);

export function sanitizeHtml(text: string): string {
  return purify.sanitize(text, {ALLOWED_TAGS: []});
}
