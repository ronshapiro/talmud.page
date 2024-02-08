import * as DOMPurify from "dompurify";
import {JSDOM} from "jsdom";
import {sanitizeHtmlHelper} from "./html_sanitization_base";

const purify = DOMPurify(new JSDOM().window);

export function sanitizeHtml(text: string): string {
  return sanitizeHtmlHelper(text, purify);
}
