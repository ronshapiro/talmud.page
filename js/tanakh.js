import {getCommentaryTypes} from "./commentaryTypes.ts";
import {driveClient} from "./google_drive/singleton.ts";
import {Runner} from "./page_runner.js";
import {Renderer, numericalNavigationExtension} from "./Renderer.tsx";

class TanakhRenderer extends Renderer {
  constructor() {
    super(
      getCommentaryTypes("tanakh"),
      numericalNavigationExtension(),
      {allowCompactLayout: true});
  }

  newPageTitleHebrew(section) {
    return this.newNumericalPageTitleHebrew(section);
  }

  rendererType() { return "Tanakh"; }

  versions() {
    return [{hebrew: "טקסט ללא ניקוד", english: "Unvocalized"}];
  }
}

new Runner(new TanakhRenderer(), driveClient).main();
