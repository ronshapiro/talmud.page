import {parseOtzarLaazeiRashi} from "../otzar_laazei_rashi";

test("from Shabbat 74b", () => {
  expect(
    parseOtzarLaazeiRashi([
      `286 / (שבת עד:) / <b>פרים</b><br>מינציי"ר / `,
      `mincier / <b>לקצוץ, לרסק</b><br><span dir="ltr">✭ to mince</span>`,
    ].join("")),
  ).toEqual([
    `<b>ד"ה פרים</b> - מינציי"ר: לקצוץ, לרסק`,
    `mincier - to mince`,
  ]);
});
