const PREFIX = 'ד"ה';

export function formatOtzarLaazeiRashi(text: string): string {
  return text.substring(text.indexOf("<b>")).replace("<b>", `<b>${PREFIX} `);
}
