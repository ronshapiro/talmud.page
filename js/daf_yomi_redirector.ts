import $ from "jquery";

$.ajax({
  url: "https://sefaria.org/api/calendars",
  type: "GET",
  success: (results: any): void => {
    for (const result of results.calendar_items) {
      if (result.title.en === "Daf Yomi") {
        const [masechet, daf] = result.displayValue.en.split(" ");
        window.location.replace(`${window.location.origin}/${masechet}/${daf}`);
      }
    }
  },
  error: () => {
    document.getElementById("progress-bar")!.hidden = true;
    document.getElementById("errors")!.hidden = false;
  },
});
