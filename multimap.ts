export class ListMultimap<K, V> {
  private map = new Map<K, V[]>();

  put(key: K, value: V): void {
    this.get(key).push(value);
  }

  putAll(key: K, values: V[]): void {
    this.get(key).push(...values);
  }

  /** Returns live collections. */
  get(key: K): V[] {
    if (!this.map.has(key)) {
      this.map.set(key, []);
    }
    return this.map.get(key)!;
  }

  asMap(): Map<K, V[]> {
    return this.map;
  }
}
