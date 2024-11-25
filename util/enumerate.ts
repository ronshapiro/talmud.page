export function* enumerate<T>(iterable: Iterable<T>): Generator<[T, number]> {
  let i = 0;
  for (const item of iterable) {
    yield [item, i];
    i++;
  }
}
