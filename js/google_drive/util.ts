export function getList<T>(obj: Record<string, T[]>, key: string): T[] {
  if (!(key in obj)) {
    obj[key] = [];
  }
  return obj[key];
}
