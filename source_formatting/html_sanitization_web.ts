import * as DOMPurify from "dompurify";
import {sanitizeHtmlHelper} from "./html_sanitization_base";

const purify = DOMPurify;

export function sanitizeHtml(text: string): string {
  return sanitizeHtmlHelper(text, purify);
}
