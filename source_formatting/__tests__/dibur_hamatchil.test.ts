import {boldDibureiHamatchil} from "../dibur_hamatchil";

test("bold", () => {
  expect(boldDibureiHamatchil("hello - world", "Rashi"))
    .toBe(`<strong class="dibur-hamatchil">hello</strong> - world`);
});

test("only first match", () => {
  expect(boldDibureiHamatchil("hello - world - extra", "Rashi"))
    .toBe(`<strong class="dibur-hamatchil">hello</strong> - world - extra`);
});

test("ignores commentary typesthat aren't recognized", () => {
  expect(boldDibureiHamatchil("hello - world", "not recognized"))
    .toBe("hello - world");
});

test("requires space on both sides", () => {
  expect(boldDibureiHamatchil("hello-world", "Rashi")).toBe("hello-world");
  expect(boldDibureiHamatchil("hello -world", "Rashi")).toBe("hello -world");
  expect(boldDibureiHamatchil("hello- world", "Rashi")).toBe("hello- world");
});
