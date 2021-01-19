import * as stringify from "json-stable-stringify";

// Jest for some reason isn't resolving the default export correctly
const _stringify: (obj: any, opts?: stringify.Comparator | stringify.Options) => string = (
  // @ts-ignore
  stringify.default || stringify);

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function jsonStringify(data: any): string {
  return _stringify(data, {space: 2}).replace(/\[\n\s+]/g, "[]").replace(/{\n\s+}/g, "{}") + "\n";
}
