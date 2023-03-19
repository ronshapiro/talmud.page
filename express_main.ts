/* eslint-disable import/first,import/newline-after-import */
import {consoleLogger} from "./logger";
import {setBlockHtmlVisitorImports} from "./source_formatting/import_blocker";
setBlockHtmlVisitorImports(true);

const importTimer = consoleLogger.newTimer();
import {expressMain} from "./express";
importTimer.finish("imported express");

expressMain(parseInt(process.env.PORT!));
setBlockHtmlVisitorImports(false);
