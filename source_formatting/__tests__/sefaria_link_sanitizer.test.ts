import {SefariaLinkSanitizer} from "../sefaria_link_sanitizer";

test("removes links", () => {
  expect(
    SefariaLinkSanitizer.process(
      `hello <a href="https://world.com">world</a> <b class="klazz">test</b>`),
  ).toBe(`hello world <b class="klazz">test</b>`);
});
