import {$} from "./jquery";
import {splitOnBookName} from "../refs";

export function tryRedirect(englishTitle: string): void {
  $.ajax({
    url: "https://sefaria.org/api/calendars",
    type: "GET",
    success: (results: any): void => {
      for (const result of results.calendar_items) {
        if (result.title.en === englishTitle) {
          const [book, page] = splitOnBookName(result.ref);
          if (englishTitle === "Daily Mishnah") {
            const chapter = (x: string) => x.split(":")[0];
            const [start, end] = page.split("-");
            window.location.replace(
              `${window.location.origin}/${book}/${chapter(start)}/to/${chapter(end)}`);
          } else {
            window.location.replace(`${window.location.origin}/${book}/${page}`);
          }
        }
      }
    },
    error: () => {
      document.getElementById("progress-bar")!.hidden = true;
      document.getElementById("errors")!.hidden = false;
    },
  });
}
