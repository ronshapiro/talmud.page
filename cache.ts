import {Heap} from "heap-js";
import {checkNotUndefined} from "./js/undefined";

class Value<T> {
  constructor(
    readonly key: string,
    readonly value: T,
    public ttl: number,
    readonly weight: number,
  ) {}
}

/**
 * A cache that expires the least recently used items in order to maintain a maximum size.
 */
export class WeightBasedLruCache<T> {
  private readonly startTime: number;
  private currentSize = 0;
  private readonly ttls: Record<string, Value<T>> = {};
  private lruHeap = new Heap<Value<T>>((first: Value<T>, second: Value<T>) => {
    return first.ttl - second.ttl;
  });

  constructor(
    private readonly maxSize: number,
    private readonly weighingFunction: (t: T) => number,
    private readonly getTime = () => Date.now(),
  ) {
    if (this.maxSize <= 0) {
      throw new Error(`maxSize must be positive: ${this.maxSize}`);
    }
    this.startTime = this.getTime();
  }

  put(key: string, t: T): void {
    const weight = this.weighingFunction(t);
    if (weight > this.maxSize) {
      throw new Error(
        `${t} is larger than the maximum size of this cache: ${weight} > ${this.maxSize}`);
    }
    while (this.currentSize + weight > this.maxSize) {
      this.expireOldest();
    }
    this.currentSize += weight;

    const value = new Value(key, t, this.currentTime(), weight);
    this.ttls[key] = value;
    this.lruHeap.push(value);
  }

  get(key: string): T | undefined {
    if (!(key in this.ttls)) {
      return undefined;
    }
    const value = this.ttls[key];
    this.lruHeap.remove(value);
    value.ttl = this.currentTime();
    this.lruHeap.push(value);
    return value.value;
  }

  private currentTime(): number {
    // Subtracting the start time helps keep values simpler for debugging
    return this.getTime() - this.startTime;
  }

  private expireOldest() {
    const oldest = checkNotUndefined(this.lruHeap.pop(), "oldest");
    // eslint-disable-next-line no-console
    console.log(`Expiring ${oldest.key} from the cache`);
    delete this.ttls[oldest.key];
    this.currentSize -= oldest.weight;
  }
}
