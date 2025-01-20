export function formatListEnglish(items: string[]): string {
  const notLast = items.slice(0, -1).join(", ");
  return `${notLast} and ${items.at(-1)}`;
}

export function formatListHebrew(items: string[]): string {
  const notLast = items.slice(0, -1).join(", ");
  return `${notLast} ו ${items.at(-1)}`;
}
