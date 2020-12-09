// @ts-ignore
import {rgbColor} from "./color.ts";
// @ts-ignore
import {Range, Request} from "./types.ts";

interface LinkedText {
  text: string,
  url: string,
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
): Request[] {
  return [insertTextRequest(text, range.startIndex), {
    updateParagraphStyle: {
      paragraphStyle: {namedStyleType: style},
      fields: "*",
      range,
    },
  }];
}


function addLink(url: string, start: number, length: number): Request {
  return {
    updateTextStyle: {
      textStyle: {
        link: {url},
        underline: true,
        foregroundColor: rgbColor(44, 91, 198),
      },
      fields: "*",
      range: {
        startIndex: start,
        endIndex: start + length,
      },
    },
  };
}

export function insertTextWithUrls(
  parts: (string | LinkedText)[],
  startIndex: number,
): Request[] {
  const textParts: string[] = [];
  const links: Request[] = [];
  let length = 0;
  const addText = (text: string): void => {
    textParts.push(text);
    length += text.length;
  };
  for (const part of parts) {
    if (typeof part === "string") {
      addText(part);
    } else {
      links.push(addLink(part.url, length + startIndex, part.text.length));
      addText(part.text);
    }
  }
  return [insertTextRequest(textParts.join(""), startIndex)].concat(links);
}
