/* eslint-disable no-console */
import * as fs from "fs";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  SchemaType,
} from "@google/generative-ai";
import {books} from "../books";
import {Sugya, visitSugyot} from "./sugya_visitor";
import {jsonStringify} from "../util/json_stringify";
import {writeJson} from "../util/json_files";
import {PromiseQueue} from "../js/promises";
import {checkNotUndefined} from "../js/undefined";
import {readUtf8} from "../files";
import {stripHebrewNonlettersOrVowels} from "../hebrew";

function parseLlmJsonResponse(response: string | undefined) {
  if (!response) return undefined;
  if (typeof response !== "string") return response;

  try {
    return JSON.parse(response);
  } catch (e: any) {
    console.error("Invalid json", response);
    if (e.toString().includes("at position")) {
      const position = parseInt(e.toString().split("at position")[1]);
      console.error(">>", response.slice(position, position + 1));
    }
    return undefined;
  }
}

function extractAmudim(sugya: Sugya): string[] {
  const amudim = new Set<string>();
  for (const segment of sugya) {
    amudim.add(segment.ref.slice(0, segment.ref.lastIndexOf(":")));
  }
  return Array.from(amudim);
}

async function executePrompt(prompt: string): Promise<any | undefined> {
  const GEMINI_API_KEY = checkNotUndefined(process.env.GEMINI_API_KEY, "GEMINI_API_KEY");
  const edit = {
    type: SchemaType.OBJECT,
    description: "The edits to a Talmud segment or a commentary comment",
    required: ["ref"],
    properties: {
      ref: {type: SchemaType.STRING},
      hebrew: {type: SchemaType.STRING},
      english: {type: SchemaType.STRING},
    },
  };

  const modelConfiguration = new GoogleGenerativeAI(GEMINI_API_KEY).getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      candidateCount: 1,
      temperature: .4,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        required: ["edits"],
        properties: {
          edits: {
            type: SchemaType.ARRAY,
            items: edit,
          },
        },
      },
    },
    safetySettings: [{
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_NONE,
    }],
  });

  const result = await modelConfiguration.generateContent(prompt);
  return parseLlmJsonResponse(result?.response?.text());
}

function renameLanguageKey(key: string): string {
  if (key === "he") return "hebrew";
  if (key === "en") return "english";
  return key;
}

const ALLOWED_COMMENTARY_NAMES = new Set<string>([
  "Footnotes",
  "JPS 1985 Footnotes",
  "Jastrow",
  "Mishnah",
  "Otzar Laazei Rashi",
  "Rashbam",
  "Rashi",
  "Shulchan Arukh",
  "Steinsaltz In-Depth",
  "Steinsaltz Masechet Intro",
  "Steinsaltz Perek Intro",
  "Steinsaltz Perek Summary",
  "Steinsaltz",
  "Tosafot",
  "Tosefta",
  "Verses",
  "Versions",
]);

function rewriteApiObjects(jsonObject: any, objectName?: string): any {
  if (Array.isArray(jsonObject)) {
    return jsonObject.map(x => rewriteApiObjects(x));
  }
  if (typeof jsonObject === "object") {
    const newDict: any = {};
    for (const [key, value] of Object.entries(jsonObject)) {
      if (objectName !== "commentary" || ALLOWED_COMMENTARY_NAMES.has(key)) {
        newDict[renameLanguageKey(key)] = rewriteApiObjects(value, key);
      }
    }
    return newDict;
  }
  if (typeof jsonObject === "string") {
    return stripHebrewNonlettersOrVowels(jsonObject);
  }
  return jsonObject;
}

const promiseQueue = new PromiseQueue(1);

const BOOK_NAME = "Horayot";
visitSugyot(
  books.byCanonicalName[BOOK_NAME], {diff: {sugyotBefore: 3, sugyotAfter: 2}},
  (sugya, before, after) => {
    const firstRef = sugya[0].ref;
    if (!firstRef.includes(" 5")) {
      return;
    }
    const prompt = `You are an editor of an interactive Talmud translation.

# Input Structure
Talmud text is by-definition unstructured, but your input is an attempt at breaking apart logical segments. Segments are always at least a single sentence, but can be multiple sentences if they are meant to be read as one unit.

The segments are in order of the their appearance. The source text is the value at the \`hebrew\` key of each JSON object. The \`english\` key specifies the translation to English by the default translators. It may be unclear or may have editing issues that you will be asked to fix. The \`ref\` key indicates the unique identifier to the segment. It is constructed with the name of the masechet, a space, then the amud, then a colon and then the 1-indexed per-amud segment number.

## Commentatry

Each segment has a \`commentary\` sub object with comments related to that segment. Most common are:
- \`Steinsaltz\`: A modern Hebrew translation of the \`hebrew\` key of the segment dict. The Talmud is written in a mix of Babylonian Aramaic and Mishnaic Hebrew which are both different from modern Hebrew. In addition to being a translation, it expands unclear context, e.g. ambiguous pronoun use. The Talmud also often writes in a curt style, omits critical details.
- \`Rashi\`: the "default" commentator on traditional Jewish texts, Rashi does a combination of translating opaque terms, adds some missing or amibiguous context, rewrites the text for clarity, disambiguates between multiple manuscript versions of the Talmud to declare what is the authoritative version in his view, and more. He also commonly interprets the Talmud. While his view is often critical to understanding the Talmud, it is not always widely accepted.
- \`Tosafot\`: a common commentator that typically addresses cross-cutting and challenging questions.
- \`Verses\`: Any Biblical verses and their expanded context that are explicitly or implicitly referenced in the source segment, or are necessary to understand the text.

Comments in the Commentary can themselves havee their own nested comments.

# Objectives

Your goal is to be the editor of the input and address the following tasks.

1. Sometimes the English translation uses terms that are technical and not part of commonly spoken English, for example "roe" instead of "fish eggs". Instances of this should be rewritten so that the translation is easier to understand. Do this only for words that are outside of common knowledge. Also do this for words that are better understood in their transliterated Hebrew, e.g. <i>menora</i> instead of candelabrum.
2. The English translation should be a direct translation of the Steinsaltz modern Hebrew translation, but sometimes one misses details of the other. Make both in line with each other as much as possible.
3. Expand ambiguous pronouns. Use the names the pronouns are referring to if it's not a detriment to readability or when it is easy to get lost understanding which pronoun refers to whom.
4. Fix the start and end of bordering segments: sometimes a segment begins with a period or the end of a previously quoted verse, and these should be moved to the previous segment.
5. Add punctuation to Rashi's and Tosafot's Hebrew comments if the comments are not simple statements. Remember that their style uses hyphens to separate the dibbur hamatchil and each comment ends with a colon, not periods. Expand abbreviations if you know what they stand for, but otherwise do not change the source text beyond adding punctuation. Omit the Hebrew output if it would be identical to the source.
6. Add an English translation to all of Rashi's and Tosafot's comments.
7. If a comment has a translation in a language that is in French, German, or Spanish, translate the text into English.

# Output Format
The output should be a JSON object that specifies an \`edits\` key that maps to an array of edit objects, where each edit object has a \`ref\` that is the same as the \`ref\` key of the segment or comment that should be edited. Only include the \`hebrew\` or \`english\` keys if they are edited for the particular segment or comment. For example, if you are only editing the english translation of a comment that has a hebrew text as well, omit the hebrew key/value pair. A single shared edit object should be used for all of the edits for the same ref. Edit all the refs that apply to the objectives.

Maintain the HTML formatting of the source text when possible. For example, if you are adding punctuation to Rashi's comments that have \`<b>\` tags, the output should also have \`<b>\` tags surrounding the same words.

# Other Context

The segment in question is provided in the \`Segments to Process\` section below. To help understand the broader context, surrounding segments are provided in the \`Preceding Segments\` and \`Succeeding Segments\` sections. Use these to help understand the text but do not suggest edits for them.

# Segments to Process
${jsonStringify(rewriteApiObjects(sugya))}

# Preceding Segments
${jsonStringify(rewriteApiObjects(before.flat()))}

# Succeeding Segments
${jsonStringify(rewriteApiObjects(after.flat()))}
`;
    const fileName = `precomputed/sugya_rewriting_temp/v1-flash/${firstRef}.json`;
    if (fs.existsSync(fileName)) {
      console.log("Skipping", firstRef);
      promiseQueue.add(() => Promise.resolve([firstRef, JSON.parse(readUtf8(fileName))]));
    } else {
      promiseQueue.add(() => {
        return executePrompt(prompt)
          .catch(error => {
            console.error("Error on", firstRef, error);
            throw error;
          })
          .then(response => {
            console.log("Finished", firstRef);
            response.amudim = extractAmudim(sugya);
            writeJson(fileName, response);
            return [firstRef, response];
          });
      });
    }
  });
promiseQueue.asPromise().then(() => {
  console.log("done");
});
