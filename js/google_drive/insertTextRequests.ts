import {rgbColor} from "./color";
import {HighlightColor, Range, Request, TextStyle} from "./types";

export interface StyledText {
  text: string;
  url?: string;
  bold?: boolean;
  highlight?: HighlightColor;
}

function insertTextRequest(text: string, startIndex: number): Request {
  return {
    insertText: {
      text,
      location: {index: startIndex},
    },
  };
}

type ParagraphStyle = "HEADING_1" | "HEADING_2" | "HEADING_3" | "HEADING_4" | "NORMAL_TEXT";

export function insertFormattedTextRequests(
  text: string,
  range: Range,
  style: ParagraphStyle,
  rtl = false,
): Request[] {
  return [insertTextRequest(text, range.startIndex), {
    updateParagraphStyle: {
      paragraphStyle: {
        namedStyleType: style,
        direction: rtl ? "RIGHT_TO_LEFT" : undefined,
        // Reminder to modify the field mask if fields are added!
      },
      // The FieldMask is required here due to a weird page_break_before bug in Google docs.
      // Without it, it seems like an irrelevant field is being silently detected.
      fields: "namedStyleType,",
      range,
    },
  }];
}

// type-safe Object.assign
function mergeTextStyle(original: TextStyle, additional: TextStyle): void {
  Object.assign(original, additional);
}

function addLink(textStyle: TextStyle, url: string): void {
  mergeTextStyle(textStyle, {
    link: {url},
    underline: true,
    foregroundColor: rgbColor(44, 91, 198),
  });
}

function boldText(textStyle: TextStyle): void {
  mergeTextStyle(textStyle, {bold: true});
}

function highlightText(textStyle: TextStyle, color: HighlightColor): void {
  const backgroundColor = (() => {
    switch (color) {
      case "red":
        return rgbColor(245, 150, 147);
      case "yellow":
        return rgbColor(250, 217, 120);
      case "green":
        return rgbColor(136, 227, 140);
      case "blue":
        return rgbColor(141, 188, 252);
      case "gray":
        return rgbColor(201, 201, 201);
      default:
        throw new Error(color);
    }
  })();
  mergeTextStyle(textStyle, {backgroundColor});
}

function textStyleRequest(
  {url, bold, highlight}: StyledText,
  range: Range,
): Request | undefined {
  const textStyle = {};
  if (url) {
    addLink(textStyle, url);
  }
  if (bold) {
    boldText(textStyle);
  }
  if (highlight) {
    highlightText(textStyle, highlight);
  }

  if (Object.keys(textStyle).length === 0) {
    return undefined;
  }
  return {
    updateTextStyle: {
      textStyle,
      fields: "*",
      range,
    },
  };
}

export function insertStyledText(
  parts: (string | StyledText)[],
  startIndex: number,
  rtl = false,
): Request[] {
  const textParts: string[] = [];
  const styleRequests: Request[] = [];
  let length = 0;
  const addText = (text: string): void => {
    textParts.push(text);
    length += text.length;
  };
  for (const part of parts) {
    const text = typeof part === "string" ? part : part.text;
    if (typeof part !== "string") {
      const rangeStart = length + startIndex;
      const range = {
        startIndex: rangeStart,
        endIndex: rangeStart + text.length,
      };
      const styleRequest = textStyleRequest(part, range);
      if (styleRequest) {
        styleRequests.push(styleRequest);
      }
    }
    addText(text);
  }
  return insertFormattedTextRequests(
    textParts.join(""),
    {startIndex, endIndex: startIndex + length},
    "NORMAL_TEXT",
    rtl,
  ).concat(styleRequests);
}
