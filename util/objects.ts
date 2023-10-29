// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function hasMatchingProperty(first: any, second: any, propertyName: string): boolean {
  return propertyName in first
    && propertyName in second
    && first[propertyName] === second[propertyName];
}
