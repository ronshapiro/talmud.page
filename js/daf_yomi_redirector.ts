import {$} from "./jquery";

$.ajax({
  url: "https://sefaria.org/api/calendars",
  type: "GET",
  success: (results: any): void => {
    for (const result of results.calendar_items) {
      if (result.title.en === "Daf Yomi") {
        const ref = result.displayValue.en;
        const lastSpace = ref.lastIndexOf(" ");
        const masechet = ref.slice(0, lastSpace);
        const daf = ref.slice(lastSpace + 1);
        window.location.replace(`${window.location.origin}/${masechet}/${daf}`);
      }
    }
  },
  error: () => {
    document.getElementById("progress-bar")!.hidden = true;
    document.getElementById("errors")!.hidden = false;
  },
});
