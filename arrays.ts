export function surroundingContext<T>(array: T[], item: T, context: number): T[] {
  if (context <= 0) throw new Error(`Invalid context: ${context} must be positive`);
  const index = array.indexOf(item);
  const start = Math.max(index - context, 0);
  return array.slice(start, index + context + 1);
}
