import {LocalStorageInt, LocalStorageLru} from "../localStorage";

beforeEach(() => localStorage.clear());

describe("LocalStorageInt", () => {
  test("is undefined when unset", () => {
    expect(new LocalStorageInt("pageViews").get()).toBeUndefined();
  });

  test("is undefined when the stored value is not a number", () => {
    localStorage.pageViews = "not a number";

    expect(new LocalStorageInt("pageViews").get()).toBeUndefined();
  });

  test("round trips through localStorage as a string", () => {
    const counter = new LocalStorageInt("pageViews");
    counter.set(7);

    expect(localStorage.pageViews).toBe("7");
    expect(counter.get()).toBe(7);
    expect(new LocalStorageInt("pageViews").get()).toBe(7);
  });

  test("getAndIncrement returns the old value, starting at zero", () => {
    const counter = new LocalStorageInt("pageViews");

    expect(counter.getAndIncrement()).toBe(0);
    expect(counter.getAndIncrement()).toBe(1);
    expect(counter.get()).toBe(2);
  });

  test("incrementAndGet returns the new value, starting at one", () => {
    const counter = new LocalStorageInt("pageViews");

    expect(counter.incrementAndGet()).toBe(1);
    expect(counter.incrementAndGet()).toBe(2);
  });

  test("separate instances share the underlying key", () => {
    new LocalStorageInt("pageViews").set(41);

    expect(new LocalStorageInt("pageViews").incrementAndGet()).toBe(42);
  });
});

describe("LocalStorageLru", () => {
  const newLru = (limit = 3) => new LocalStorageLru("highlightedIds", limit);

  test("starts empty", () => {
    expect(newLru().has("a")).toBe(false);
  });

  test("remembers added items", () => {
    const lru = newLru();
    lru.add("a");
    lru.add("b");

    expect(lru.has("a")).toBe(true);
    expect(lru.has("b")).toBe(true);
    expect(lru.has("c")).toBe(false);
  });

  test("survives being reconstructed, as it is on every page load", () => {
    newLru().add("a");

    expect(newLru().has("a")).toBe(true);
  });

  test("adding an existing item is a no-op and does not reorder", () => {
    const lru = newLru(2);
    lru.add("a");
    lru.add("b");
    lru.add("a");
    lru.add("c"); // evicts the oldest

    expect(lru.has("a")).toBe(false);
    expect(lru.has("b")).toBe(true);
    expect(lru.has("c")).toBe(true);
  });

  test("evicts the oldest item once past the limit", () => {
    const lru = newLru(3);
    for (const item of ["a", "b", "c", "d"]) lru.add(item);

    expect(lru.has("a")).toBe(false);
    expect(["b", "c", "d"].every(x => lru.has(x))).toBe(true);
  });

  test("never grows beyond the limit", () => {
    const lru = newLru(3);
    for (let i = 0; i < 20; i++) lru.add(`item-${i}`);

    expect(localStorage.highlightedIds.split("@__delimitter__@")).toHaveLength(3);
  });

  test("removes items", () => {
    const lru = newLru();
    lru.add("a");
    lru.add("b");
    lru.remove("a");

    expect(lru.has("a")).toBe(false);
    expect(newLru().has("b")).toBe(true);
  });

  test("removing the last item clears the key rather than storing an empty string", () => {
    const lru = newLru();
    lru.add("a");
    lru.remove("a");

    expect(localStorage.highlightedIds).toBeUndefined();
    expect(newLru().has("a")).toBe(false);
  });

  test("removing an absent item is harmless", () => {
    const lru = newLru();
    lru.add("a");
    lru.remove("nope");

    expect(lru.has("a")).toBe(true);
  });

  test("handles refs containing characters that appear in the delimiter", () => {
    const lru = newLru();
    lru.add("Berakhot 2a:1@__delimitter");

    expect(newLru().has("Berakhot 2a:1@__delimitter")).toBe(true);
  });
});
