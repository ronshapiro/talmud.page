import {Application} from "express";

interface Calendar {
  sefariaCalendarName: string;
  webTitleName: string;
  todaysNoun: string;
  todaysNounError: string;
  route: string;
}

const calendars: Calendar[] = [{
  sefariaCalendarName: "Daf Yomi",
  webTitleName: "Daf Yomi",
  todaysNoun: "Daf",
  todaysNounError: "daf",
  route: "/daf-yomi",
}, {
  sefariaCalendarName: "Daily Mishnah",
  webTitleName: "Mishna Yomi",
  todaysNoun: "Mishnayot",
  todaysNounError: "mishnayot",
  route: "/mishna-yomit",
}, {
  sefariaCalendarName: "Daily Rambam",
  webTitleName: "Rambam Yomi",
  todaysNoun: "Rambam",
  todaysNounError: "Rambam",
  route: "/rambam-yomi",
}];

export function registerCalendarRoutes(app: Application): void {
  for (const calendar of calendars) {
    app.get(calendar.route, (req, res) => res.render("calendar.html", calendar));
  }
}
