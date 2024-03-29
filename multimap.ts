export class ListMultimap<K, V> {
  private map = new Map<K, V[]>();

  keys(): Iterable<K> {
    return this.map.keys();
  }

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

  sortedCopy(): ListMultimap<K, V> {
    const copy = new ListMultimap<K, V>();
    const keys = Array.from(this.map.keys());
    keys.sort();
    for (const key of keys) {
      copy.putAll(key, this.get(key));
    }
    return copy;
  }

  static identity<E>(elements: E[]): ListMultimap<E, E> {
    const multimap = new ListMultimap<E, E>();
    for (const e of elements) multimap.put(e, e);
    return multimap;
  }
}
