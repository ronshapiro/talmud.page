import {formatOtzarLaazeiRashi} from "../otzar_laazei_rashi";

test("from Shabbat 74b", () => {
  expect(
    formatOtzarLaazeiRashi([
      `286 / (שבת עד:) / <b>פרים</b><br>מינציי"ר / `,
      `mincier / <b>לקצוץ, לרסק</b><br><span dir="ltr">✭ to mince</span>`,
    ].join("")),
  ).toBe([
    `<b>ד"ה פרים</b><br>מינציי"ר / `,
    `mincier / <b>לקצוץ, לרסק</b><br><span dir="ltr">✭ to mince</span>`,
  ].join(""));
});
