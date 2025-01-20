import {Application} from "express";

interface Calendar {
  sefariaCalendarName: string;
  webTitleName: string;
  webTitleNameHebrew: string;
  todaysNoun: string;
  todaysNounHebrew: string;
  todaysNounError: string;
  route: string;
}

const calendars: Calendar[] = [{
  sefariaCalendarName: "Daf Yomi",
  webTitleName: "Daf Yomi",
  webTitleNameHebrew: "דף היומי",
  todaysNoun: "Daf",
  todaysNounHebrew: "דף היומי",
  todaysNounError: "daf",
  route: "/daf-yomi",
}, {
  sefariaCalendarName: "Daily Mishnah",
  webTitleName: "Mishna Yomi",
  webTitleNameHebrew: "משנה יומית",
  todaysNoun: "Mishnayot",
  todaysNounHebrew: "משנה היומית",
  todaysNounError: "mishnayot",
  route: "/mishna-yomit",
}, {
  sefariaCalendarName: "Daily Rambam",
  webTitleName: "Rambam Yomi",
  webTitleNameHebrew: 'רמב"ם היומי',
  todaysNoun: "Rambam",
  todaysNounHebrew: 'רמב"ם היומי',
  todaysNounError: "Rambam",
  route: "/rambam-yomi",
}];

export function registerCalendarRoutes(app: Application): void {
  for (const calendar of calendars) {
    app.get(calendar.route, (req, res) => res.render("calendar.html", calendar));
  }
}
