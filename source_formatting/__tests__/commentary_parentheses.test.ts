import {CommentaryParenthesesTransformer} from "../commentary_parentheses";

test("parenthesize", () => {
  expect(CommentaryParenthesesTransformer.process("hello (world) [brackets]"))
    .toBe(`hello <span class="parenthesized">(world)</span> [brackets]`);
});
