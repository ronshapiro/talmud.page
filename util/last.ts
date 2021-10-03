export function getLast<T>(items: T[]): T {
  return items.slice(-1)[0];
}
