import {CommentaryPrefixStripper} from "../commentary_prefixes";

test("just text", () => {
  expect(CommentaryPrefixStripper.process("גמ' hello")).toBe("hello");
});

test("in middle of test", () => {
  expect(CommentaryPrefixStripper.process("hello גמ'")).toBe("hello גמ'");
});

test("in tags", () => {
  expect(CommentaryPrefixStripper.process("<b><i>גמ' hello</i></b> world"))
    .toBe("<b><i>hello</i></b> world");
});

test("in tags, after some text", () => {
  expect(CommentaryPrefixStripper.process("leading<b><i>גמ'</i></b> hello"))
    .toBe("leading<b><i>גמ'</i></b> hello");
});
