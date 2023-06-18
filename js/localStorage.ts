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
