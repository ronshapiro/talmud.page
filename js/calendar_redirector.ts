import {$} from "./jquery";
import {splitOnBookName} from "../refs";
import {isSiteLanguageHebrew} from "./settings";

export function tryRedirect(englishTitle: string): void {
  $.ajax({
    url: "https://sefaria.org/api/calendars",
    type: "GET",
    success: (results: any): void => {
      for (const result of results.calendar_items) {
        if (result.title.en === englishTitle) {
          const [book, page] = splitOnBookName(result.ref);
          const navigateToPage = (suffix: string) => {
            window.location.replace(`${window.location.origin}/${book}/${suffix}`);
          };
          if (englishTitle === "Daily Mishnah") {
            const [start, end] = page.split("-");
            const startChapter = start.split(":")[0];
            const endChapter = end.includes(":") ? end.split(":")[0] : startChapter;
            const refLink = result.ref.split("-")[0];
            navigateToPage(`${startChapter}/to/${endChapter}?ref_link=${refLink}`);
          } else {
            navigateToPage(page);
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

setTimeout(
  () => {
    const id = isSiteLanguageHebrew() ? "title-hebrew" : "title-english";
    document.getElementById("title")!.textContent = (
      document.getElementById(id) as HTMLMetaElement)!.content;
  },
  10);

tryRedirect((document.getElementById("sefariaCalendarName") as HTMLMetaElement).content);
