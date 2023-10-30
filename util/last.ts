export function getLast<T>(items: T[]): T {
  if (items.length === 0) throw new Error("empty");
  return items.at(-1)!;
}
