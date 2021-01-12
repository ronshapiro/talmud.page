import {WeightBasedLruCache} from "../cache";

const newCache = (size: number) => {
  let time = 0;
  const timer = () => time++;
  return new WeightBasedLruCache<string>(size, x => x.length, timer);
};

test("get and put", () => {
  const cache = newCache(Number.MAX_SAFE_INTEGER);

  cache.put("hello", "world");
  cache.put("world", "hello2");

  expect(cache.get("hello")).toBe("world");
  expect(cache.get("world")).toBe("hello2");
});

test("too heavy", () => {
  const cache = newCache(5);

  expect(() => cache.put("hello", "world!")).toThrow();
});

test("expire oldest", () => {
  const cache = newCache(3);
  cache.put("1", "1");
  cache.put("2", "2");
  cache.put("3", "3");
  cache.put("4", "4");

  expect(cache.get("1")).toBe(undefined);
});

test("get resets oldest", () => {
  const cache = newCache(3);
  cache.put("1", "1");
  cache.put("2", "2");
  cache.put("3", "3");

  cache.get("1");

  cache.put("4", "4");

  expect(cache.get("1")).toBe("1");
  expect(cache.get("2")).toBe(undefined);
});

test("multiple get resets oldest", () => {
  const cache = newCache(3);
  cache.put("1", "1");
  cache.put("2", "2");
  cache.put("3", "3");

  cache.get("1");
  cache.get("2");

  cache.put("4", "4");

  expect(cache.get("1")).toBe("1");
  expect(cache.get("2")).toBe("2");
  expect(cache.get("3")).toBe(undefined);
});

test("expire many at once", () => {
  const cache = newCache(3);
  cache.put("1", "1");
  cache.put("2", "2");
  cache.put("x", "xyz");

  expect(cache.get("1")).toBe(undefined);
  expect(cache.get("2")).toBe(undefined);
  expect(cache.get("x")).toBe("xyz");
});

test("non-positive max size", () => {
  expect(() => newCache(0)).toThrow();
  expect(() => newCache(-1)).toThrow();
});
