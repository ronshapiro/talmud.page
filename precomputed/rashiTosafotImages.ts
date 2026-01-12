import * as fs from "fs";
import {timeoutPromise} from "../js/promises";
import {Amud} from "../apiTypes";
import {books} from "../books";
import {cachedOutputFilePath} from "../cached_outputs";
import {writeJson} from "../util/json_files";
import {checkNotUndefined} from "../js/undefined";
import {
  Content,
  GoogleGenAI,
  InlinedRequest,
  InlinedResponse,
  JobState,
  Part
} from "@google/genai";
import {readUtf8} from "../files";

const client = new GoogleGenAI({
  // apiKey: checkNotUndefined(process.env.GEMINI_API_KEY, "GEMINI_API_KEY"),
});
const PROMPT = "Redraw this diagram but make it crisper and easier to read the text.";
const MODEL_TYPE = "gemini-3-pro-image-preview";


const segmentsPerPage: Record<string, number> = {};

const requests: InlinedRequest[] = [];
const pseudoRefs: string[] = [];
const texts: string[] =  [];
for (const book of books.allBooks) {
  if (!book.isBibleBook() && !book.isTalmud() && !book.isMishna()) continue;
  if (book.canonicalName === "Shekalim") continue;

  for (const page of Array.from(book.sections)) {
    const result = JSON.parse(
      fs.readFileSync(cachedOutputFilePath(book, page), {encoding: "utf-8"})) as Amud;
    for (const segment of result.sections) {
      for (const commentary of [
        book.canonicalName === "Sukkah" ? undefined : segment.commentary?.Rashi,
        segment.commentary?.Tosafot]) {
        for (const comment of commentary?.comments ?? []) {
          let imageIndex = 0;
          let text = (comment.he as string);
          const originalText = text;
          while (text.includes("<img")) {
            const start = text.indexOf("<img");
            const end = text.indexOf(">", start) + 1;
            const imageTag = text.slice(start, end);
            const match = text.match(/base64,([^"]+)/)!;
            const imagePart: Part = {
              inlineData: {
                data: match[1],
                mimeType: "image/png",
              },
            };
            requests.push({
              model: MODEL_TYPE,
              contents: [{ role: "user", parts: [imagePart, { text: PROMPT }] }],
              config: {
                responseModalities: ["IMAGE"], 
              },
            });

            const pseudoRef = `${comment.ref}_image_${imageIndex}`;
            texts.push(originalText);
            pseudoRefs.push(pseudoRef);
            fs.writeFileSync(
              `precomputed/rashiTosafotImages/${pseudoRef}.png`,
              Buffer.from(match[1], 'base64'));
            
            text = text.slice(end);
            imageIndex++;
          }
        }
      }
    }
  }
}

async function executeRequests(inlinedRequests: InlinedRequest[]) {
  /*
  let batchJob = await client.batches.create({
    model: MODEL_TYPE,
    src: inlinedRequests,
    config: {displayName: "Rashi and Tosafot images"},
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
  console.log("RETURNED");

  if (batchJob.state !== JobState.JOB_STATE_SUCCEEDED) {
    throw new Error(`Job failed with state: ${batchJob.state}`);
  }

  */
  let i = 0;
  const RES = JSON.parse(readUtf8("nb.json")) as InlinedResponse[];
  for (const response of RES) {
    if (!response.response?.candidates![0].content!.parts) {
      console.log(response);
    } else {
    const outputPart = response.response?.candidates![0].content!.parts!.find(
      part => part.inlineData);

    const pseudoRef = pseudoRefs[i];
    if (!outputPart || !outputPart.inlineData) {
      console.log("No image was generated in the response for ", pseudoRef);
    } else {
      fs.writeFileSync(
        `precomputed/rashiTosafotImages_out/${pseudoRef}.png`,
        Buffer.from(outputPart!.inlineData!.data!, "base64"));
    }
    }
    i++;
  }
  
}

// executeRequests(requests)

console.log(`<html><head><style>
table, th, td {
  border: 1px solid;
}
.text {
width: 500px
}
</style></head><body><table>`);
for (let i = 0; i < pseudoRefs.length; i++) {
  const r = pseudoRefs[i];
  console.log(`<tr><td>${r}</td><td>${texts[i]}</td>`);
  console.log(`<td class="text"><img width=200 src="/Users/ronshapiro/talmud.page/precomputed/rashiTosafotImages_out/${r}.png" /></td>`);
  console.log("</tr>");
}

console.log("</table></body></html>");
