// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function hasMatchingProperty(first: any, second: any, propertyName: string): boolean {
  return propertyName in first
    && propertyName in second
    && first[propertyName] === second[propertyName];
}


export function sortedEntries<T>(x: Record<string, T>, sortOrder: string[]) {
  return Object.entries(x).sort((a, b) => {
    return sortOrder.indexOf(a[0]) - sortOrder.indexOf(b[0]);
  });
}
