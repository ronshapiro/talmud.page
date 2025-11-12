import * as stringify from "json-stable-stringify";

// Jest for some reason isn't resolving the default export correctly
const _stringify: (obj: any, opts?: stringify.Comparator | stringify.Options) => string = (
  // @ts-ignore
  stringify.default || stringify);

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function jsonStringifyOld(data: any): string {
  return _stringify(data, {space: 2}).replace(/\[\n\s+]/g, "[]").replace(/{\n\s+}/g, "{}") + "\n";
}

const PRIORITY_KEYS = ["ref", "he", "hebrew", "en", "english"];

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function jsonStringify(data: any): string {
  return _stringify(
    data, {
      space: 2,
      cmp: (a, b) => {
        const aIndex = PRIORITY_KEYS.indexOf(a.key);
        const bIndex = PRIORITY_KEYS.indexOf(b.key);
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.key < b.key ? -1 : 1;
      },
    },
  ).replace(/\[\n\s+]/g, "[]").replace(/{\n\s+}/g, "{}") + "\n";
}
