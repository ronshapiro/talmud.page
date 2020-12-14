// @ts-ignore
import {rgbColor} from "./color.ts";
// @ts-ignore
import {Range, Request} from "./types.ts";

interface StyledText {
  text: string;
  url: string | undefined;
  bold: boolean | undefined;
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
      },
      fields: "*",
      range,
    },
  }];
}

function addLink(url: string, range: Range): Request {
  return {
    updateTextStyle: {
      textStyle: {
        link: {url},
        underline: true,
        foregroundColor: rgbColor(44, 91, 198),
      },
      fields: "*",
      range,
    },
  };
}

function boldText(range: Range): Request {
  return {
    updateTextStyle: {
      textStyle: {
        bold: true,
      },
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
    const rangeStart = length + startIndex;
    const range = {startIndex: rangeStart, endIndex: rangeStart + text.length};
    if (typeof part !== "string") {
      if (part.url) {
        styleRequests.push(addLink(part.url, range));
      }
      if (part.bold) {
        styleRequests.push(boldText(range));
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
