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

    range: () => {
      const metadata = amudMetadata();
      if (!metadata.amudStart) {
        return [];
      }
      if (!metadata.amudEnd) {
        return [metadata.amudStart];
      }

      let current = metadata.amudStart;
      const results = [current];
      while (current !== metadata.amudEnd) {
        current = computeNextAmud(current);
        results.push(current);
      }
      return results;
    },
  },
);

new Runner(renderer, driveClient).main();
