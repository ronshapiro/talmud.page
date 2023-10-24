export class LocalStorageInt {
  constructor(private readonly key: string) {}

  get(): number | undefined {
    const value = parseInt(localStorage[this.key]);
    return Number.isNaN(value) ? undefined : value;
  }

  set(value: number): void {
    localStorage[this.key] = value;
  }

  getAndIncrement(): number {
    const value = this.get() || 0;
    this.set(value + 1);
    return value;
  }

  incrementAndGet(): number {
    const value = (this.get() || 0) + 1;
    this.set(value);
    return value;
  }
}

export class LocalStorageLru {
  private items: string[];
  private delimitter = "@__delimitter__@";

  constructor(
    private readonly key: string,
    private readonly limit: number,
  ) {
    this.items = localStorage[key]?.split(this.delimitter) || [];
  }

  has(item: string): boolean {
    return this.items.includes(item);
  }

  add(item: string): void {
    if (this.has(item)) return;
    this.items.push(item);
    if (this.items.length > this.limit) {
      this.items = this.items.slice(1, 1 + this.limit);
    }
    this.save();
  }

  remove(item: string): void {
    this.items = this.items.filter(x => x !== item);
    this.save();
  }

  private save() {
    if (this.items.length > 0) {
      localStorage[this.key] = this.items.join(this.delimitter);
    } else {
      delete localStorage[this.key];
    }
  }
}
