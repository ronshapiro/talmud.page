import * as DOMPurify from "dompurify";
import {sanitizeHtmlHelper} from "./html_sanitization_base";

console.log(DOMPurify)
const purify = DOMPurify.default();

export function sanitizeHtml(text: string): string {
  return sanitizeHtmlHelper(text, purify);
}
