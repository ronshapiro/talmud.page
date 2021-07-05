export function htmlEscape(text: string): string {
  return (text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#039;")
    .replace(/"/g, "&quot;"));
}
