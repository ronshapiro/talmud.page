// Total guess
const OBJECT_FIXED_SIZE = 4;

/**
 * Approximates the memory footprint of a JSON object.
 *
 * This will never be fully accurate, as it cannot account for overhead of objects, cached values in
 * the VM, etc, but it can act as a good heuristic for a cache. The size of the cache can be tuned
 * accordingly, even if it's not fully accurate.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function jsonSize(json: any): number {
  const type = typeof json;
  if (type === "number") {
    // Numbers are 64-bit in JavaScript
    return 8;
  }
  if (!json || type === "boolean") {
    return 1;
  }
  if (type === "string") {
    return json.length;
  }
  if (Array.isArray(json)) {
    return json.map(jsonSize).reduce((x, y) => x + y, OBJECT_FIXED_SIZE);
  }

  // no need to add OBJECT_FIXED_SIZE, as the recursive call will take that into account with the
  // array of keys and values.
  return jsonSize(Object.keys(json).concat(Object.values(json)));
}
