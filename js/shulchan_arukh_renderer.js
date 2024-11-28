import {getCommentaryTypes} from "./commentaryTypes.ts";
import {driveClient} from "./google_drive/singleton.ts";
import {Runner} from "./page_runner.js";
import {Renderer, numericalNavigationExtension} from "./Renderer.tsx";

class ShulchanArukhRenderer extends Renderer {
  constructor() {
    super(
      getCommentaryTypes("shulchan arukh"),
      numericalNavigationExtension(),
      {allowCompactLayout: false});
  }

  newPageTitleHebrew(section) {
    return this.newNumericalPageTitleHebrew(section);
  }
}

new Runner(new ShulchanArukhRenderer(), driveClient).main();
