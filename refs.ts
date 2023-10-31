export function splitOnBookName(ref: string): [string, string] {
  const lastSpace = ref.lastIndexOf(" ");
  return [ref.slice(0, lastSpace), ref.slice(lastSpace + 1)];
}
