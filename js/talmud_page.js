import {books} from "./books.ts";
import {TalmudRenderer} from "./rendering.jsx";
import {amudMetadata, computePreviousAmud, computeNextAmud} from "./amud.ts";
import {driveClient} from "./google_drive/singleton.ts";
import {Runner} from "./page_runner.js";

const renderer = new TalmudRenderer(
  localStorage.translationOption || "english-side-by-side",
  localStorage.wrapTranslations !== "false",
  localStorage.expandEnglishByDefault === "true",
  {
    previous: () => computePreviousAmud(amudMetadata().amudStart),
    next: () => computeNextAmud(amudMetadata().amudEnd),

    hasPrevious: () => {
      const metadata = amudMetadata();
      const bounds = books[metadata.masechet];
      return metadata.amudStart !== bounds.start;
    },
    hasNext: () => {
      const metadata = amudMetadata();
      const bounds = books[metadata.masechet];
      return metadata.amudEnd !== bounds.end;
    },
  },
);

new Runner(renderer, driveClient, "talmud").main();
