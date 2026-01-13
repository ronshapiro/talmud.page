/* eslint-disable no-console */
import * as fs from "fs";
import {
  Content,
  GoogleGenAI,
  HarmBlockThreshold,
  HarmCategory,
  InlinedRequest,
  InlinedResponse,
  JobState,
  SafetySetting,
} from "@google/genai";
import {SchemaType} from "@google/generative-ai";
import * as yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import {books, Book} from "../books";
import {chapterSugyot, Sugya} from "./sugya_visitor";
import {writeJson} from "../util/json_files";
import {checkNotUndefined} from "../js/undefined";
import {stripHebrewNonlettersOrVowels} from "../hebrew";
import {ApiComment} from "../apiTypes";
import {timeoutPromise} from "../js/promises";

const FLAGS = yargs(hideBin(process.argv))
  .options({
    dry_run: { type: 'boolean', default: true},
  })
  .parseSync();

const MAX_ADDITIONAL_SUGYOT = 3;
const MODEL_TYPE = "gemini-2.5-flash";
const client = new GoogleGenAI({
  apiKey: checkNotUndefined(process.env.GEMINI_API_KEY, "GEMINI_API_KEY"),
});

function outputFileForRef(firstRef: string): string {
  return `precomputed/sugya_rewriting_temp/v1-flash/${firstRef}.json`;
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

const IGNORED_KEYS = new Set(["sourceHeRef", "link", "expandedRefsAfterRewriting"]);

function rewriteApiObjects(jsonObject: any, objectName?: string): any {
  if (Array.isArray(jsonObject)) {
    return jsonObject.map(x => rewriteApiObjects(x));
  }
  if (typeof jsonObject === "object") {
    const newDict: any = {};
    for (const [key, value] of Object.entries(jsonObject)) {
      if (objectName === "Verses") {
        newDict.comments = (value as ApiComment[]).map((x: any) => {
          return {ref: x.ref, expandedRefsAfterRewriting: x.expandedRefsAfterRewriting};
        });
        if (key === "ref") newDict.ref = value;
      } else if (IGNORED_KEYS.has(key)) {
        continue;
      } else if (objectName !== "commentary" || ALLOWED_COMMENTARY_NAMES.has(key)) {
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

const SYSTEM_PROMPT_PART = {
  role: "model",
  parts: [{
    text: `You are an editor of an interactive Talmud translation.

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

To help understand the broader context, read all the segments provided in the \`Talmud Context\`. But only suggest edits for the RequestedSugyaRef provided below.`,
  }],
};

function editsSchema(): any {
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

  return {
    type: SchemaType.OBJECT,
    required: ["edits"],
    properties: {
      edits: {
        type: SchemaType.ARRAY,
        items: edit,
      },
    },
  };
}

function safetySettings(): SafetySetting[] {
  return [{
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  }];
}

function parseLlmJsonResponse(response: string | undefined): any | undefined {
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

interface SugyaWithRef {
  sugya: Sugya;
  sugyaRef: string;
}

function cachedPrompt(sugyot: SugyaWithRef[]): Content[] {
  return [
    SYSTEM_PROMPT_PART,
    {
      role: "user",
      parts: [{
        text: `# Talmud Context

<data>${JSON.stringify(rewriteApiObjects(sugyot))}</data>

`,
      }],
    },
  ];
}

interface SugyotToPrompt {
  sugyotToRequest: Sugya[];
  preamble: Content[];
  firstRefInPreamble: string;
  lastRefInPreamble: string;
}

async function sugyotToPrompt(book: Book): Promise<SugyotToPrompt | undefined> {
  const CHAPTERS = chapterSugyot(book);
  for (const chapter of CHAPTERS) {
    for (let i = 0; i < chapter.length; i++) {
      const sugya = chapter[i];
      // TODO: it could be that a sugya is so long that we run out of output tokens in trying to
      // fulfill the request. Then we either don't get a response, or get a partial response that
      // doesn't address everything in the sugya. We should check the output length from the result
      // and log an error if it hits the max.
      const fileName = outputFileForRef(sugya[0].ref);
      if (fs.existsSync(fileName)) continue;

      // TODO: consider modulating how many sugyot back to go based on their length. i.e. if the
      // most previous one was long, then cut it.
      let j = Math.max(0, i - 3);

      const sugyotForContext: SugyaWithRef[] = [];
      for (; j < chapter.length; j++) {
        const sugyaBlock = {sugya: chapter[j], sugyaRef: chapter[j][0].ref};
        // eslint-disable-next-line no-await-in-loop
        const tokenLengthResponse = await client.models.countTokens({
          model: MODEL_TYPE,
          contents: cachedPrompt([...sugyotForContext, sugyaBlock]),
        });

        if ((tokenLengthResponse.totalTokens ?? 999_999_999) < 250_000) {
          sugyotForContext.push(sugyaBlock);
        } else {
          break;
        }
      }

      if (sugyotForContext.length === 0) {
        if (j !== chapter.length) {
          throw new Error("No sugyot found!");
        }
        break;
      } else {
        const stopAtSugya = (() => {
          for (let diff = 0; diff < MAX_ADDITIONAL_SUGYOT; diff++) {
            if (j + diff === chapter.length) return chapter.length - diff;
          }
          return Math.max(i + 1, j - MAX_ADDITIONAL_SUGYOT);
        })();

        const lastSegment = sugyotForContext.at(-1)!.sugya.at(-1)!;
        return {
          sugyotToRequest: chapter.slice(i, stopAtSugya).filter(
            s => !fs.existsSync(outputFileForRef(s[0].ref))),
          preamble: cachedPrompt(sugyotForContext),
          firstRefInPreamble: sugyotForContext[0].sugya[0].ref,
          lastRefInPreamble: lastSegment.ref,
        };
      }
    }
  }
  return undefined;
}

function extractAmudim(sugya: Sugya): string[] {
  const amudim = new Set<string>();
  for (const segment of sugya) {
    amudim.add(segment.ref.slice(0, segment.ref.lastIndexOf(":")));
  }
  return Array.from(amudim);
}

function noThoughtSignature(jsonObject: any): any {
  if (Array.isArray(jsonObject)) {
    return jsonObject.map(x => noThoughtSignature(x));
  }
  if (typeof jsonObject === "object") {
    const newDict: any = {};
    for (const [key, value] of Object.entries(jsonObject)) {
      if (key !== "thoughtSignature") {
        newDict[key] = noThoughtSignature(value);
      }
    }
    return newDict;
  }
  return jsonObject;
}

function parseAndWriteResponses(responses: InlinedResponse[], sugyot: Sugya[]) {
  if (responses.length !== sugyot.length) {
    throw new Error(`Invalid lengths: ${responses.length} ${sugyot.length}`);
  }

  for (let i = 0; i < responses.length; i++) {
    const parsedResponse = parseLlmJsonResponse(
      responses[i].response!.candidates![0].content!.parts![0].text);
    if (!parsedResponse) continue;
    const sugya = sugyot[i];
    parsedResponse.amudim = extractAmudim(sugya);
    writeJson(outputFileForRef(sugya[0].ref), parsedResponse);
  }
}

async function cachingStrategyMain() {
  const book = books.byCanonicalName.Zevachim;
  const sugyotToPromptResult = await sugyotToPrompt(book);
  if (sugyotToPromptResult === undefined) {
    console.error("Returned undefined!");
    return;
  }

  const {sugyotToRequest, preamble, firstRefInPreamble, lastRefInPreamble} = sugyotToPromptResult!;
  if (sugyotToRequest.length === 0) {
    throw new Error("No sugyot to request!");
  }

  const label = `${firstRefInPreamble} to ${lastRefInPreamble} [${MODEL_TYPE}]`;
  if (FLAGS.dry_run) {
    console.debug(`[[DRY RUN]]: Would cache context for ${label}`);
    return;
  }
  const cacheCallStart = Date.now();
  console.log("Starting cache call");
  const cacheResult = await client.caches.create({
    model: MODEL_TYPE,
    config: {
      contents: preamble,
      displayName: `Cached content for ${label}`,
      // TODO: could this be reduced? It seems so, but it also is unlikely to be too costly, about
      // 0.83 cents at 250k input tokens.
      ttl: "120s",
    },
  });
  const cacheCallReturned = Date.now();
  console.log("Cache result", cacheResult, "took", (cacheCallReturned - cacheCallStart) / 1000);

  const inlinedRequests: InlinedRequest[] = [];
  for (const sugya of sugyotToRequest) {
    const firstRef = sugya[0].ref;
    inlinedRequests.push({
      contents: {
        parts: [{ text: `# Concrete Instructions
Execute the objectives for RequestedSugyaRef=${firstRef}.
.`}],
        role: "user",
      },
      config: {
        cachedContent: cacheResult.name,
        responseMimeType: "application/json",
        responseSchema: editsSchema(),
        safetySettings: safetySettings(),
        stopSequences: [
          "\\n\\n\\n\\n",
          "\\r",
          "\\t\\t",
          ": : :",
        ],
        // frequencyPenalty: 0.1,
        /*
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        }
        */
      },
    });
  }

  let batchJob = await client.batches.create({
    model: MODEL_TYPE,
    src: inlinedRequests,
    config: {displayName: `Batch requests for ${label}`},
  });
  const batchJobName = batchJob.name!;

  let waitUntil = 10;
  while (batchJob?.state === JobState.JOB_STATE_RUNNING
    || batchJob?.state === JobState.JOB_STATE_PENDING) {
    console.log(`Status: ${batchJob.state}... waiting until ${waitUntil} seconds.`);
    waitUntil += 10;
    // eslint-disable-next-line no-await-in-loop
    await timeoutPromise(10_000);
    // eslint-disable-next-line no-await-in-loop
    batchJob = await client.batches.get({ name: batchJobName });
  }
  console.log("Took", Date.now() - cacheCallReturned, "to finish batch requests");

  if (batchJob.state !== JobState.JOB_STATE_SUCCEEDED) {
    throw new Error(`Job failed with state: ${batchJob.state}`);
  }

  const responses = batchJob.dest!.inlinedResponses;
  writeJson(
    `precomputed/sugya_rewriting_temp/temp_results/${firstRefInPreamble}.${MODEL_TYPE}.json`,
    responses);
  writeJson(
    `precomputed/sugya_rewriting_temp/temp_results/${firstRefInPreamble}.${MODEL_TYPE}.no_thought_signature.json`,
    noThoughtSignature(responses));

  try {
    await client.caches.delete({name: cacheResult.name!});
  } catch (e) {
    console.error(`Couldn't delete ${cacheResult.name}`, e);
  }

  if (responses) {
    parseAndWriteResponses(responses!, sugyotToRequest);
  }
}

cachingStrategyMain();
