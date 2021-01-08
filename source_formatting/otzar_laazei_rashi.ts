import {sefariaTextTypeTransformation} from "../sefariaTextType";

const PREFIX = 'ד"ה';

export const formatOtzarLaazeiRashi = sefariaTextTypeTransformation(
  text => text.substring(text.indexOf("<b>")).replace("<b>", `<b>${PREFIX} `));
