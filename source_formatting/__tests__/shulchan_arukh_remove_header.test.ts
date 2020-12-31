import {ShulchanArukhHeaderRemover} from "../shulchan_arukh_remove_header";

test("removeHeaders", () => {
  expect(ShulchanArukhHeaderRemover.process("<b>Remove<i>me</i></b><b>Keep <i>me</i></b>"))
    .toBe("<b>Keep <i>me</i></b>");
});

test("removeBrTags", () => {
  expect(ShulchanArukhHeaderRemover.process("<b>Remove me</b><br>Keep <br>me<br>"))
    .toBe("Keep me");
});
