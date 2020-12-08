// @ts-ignore
import {rgbColor} from "./color.ts";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Request extends gapi.client.docs.Request {}

interface LinkedText {
  text: string,
  url: string,
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
  return [{
    insertText: {
      text: textParts.join(""),
      location: {index: startIndex},
    },
  } as Request].concat(links);
}
