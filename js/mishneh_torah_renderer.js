import {getCommentaryTypes} from "./commentaryTypes.ts";
import {driveClient} from "./google_drive/singleton.ts";
import {Runner} from "./page_runner.js";
import {Renderer, numericalNavigationExtension} from "./Renderer.tsx";

class MishnehTorahRenderer extends Renderer {
  constructor() {
    super(
      getCommentaryTypes("mishneh torah"),
      numericalNavigationExtension(),
      {allowCompactLayout: false});
  }

  newPageTitleHebrew(section) {
    return this.newNumericalPageTitleHebrew(section);
  }
}

new Runner(new MishnehTorahRenderer(), driveClient).main();
