import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerateContentResult,
  HarmCategory,
  HarmBlockThreshold,
  SchemaType,
} from "@google/generative-ai";
// import {OpenAI as OpenAiApi} from "openai";
// import {zodResponseFormat} from "openai/helpers/zod";
// import {z} from "zod";
import {ApiResponse} from "../apiTypes";
import {books} from "../books";
import {readUtf8} from "../files";
import {checkNotUndefined} from "../js/undefined";
// import {timeoutPromise} from "../js/promises";
import {RealRequestMaker} from "../request_makers";
import {writeJson} from "../util/json_files";
import {ConsoleLogger, Logger} from "../logger";

function* bibleChapters(): Generator<ApiResponse> {
  for (const book of Object.values(books.byCanonicalName)) {
    if (!book.isBibleBook()) continue;
    for (let chapter = 1; true; chapter += 1) {
      try {
        const path = `cached_outputs/api_request_handler/${book.canonicalName}.${chapter}.json`;
        yield JSON.parse(readUtf8(path)) as ApiResponse;
      } catch (e: any) {
        if (e.code === "ENOENT") break;
        throw e;
      }
    }
  }
}

function primacy(topic: any): number {
  return Math.max(
    topic.order.curatedPrimacy?.en ?? Number.MIN_SAFE_INTEGER,
    topic.order.curatedPrimacy?.he ?? Number.MIN_SAFE_INTEGER);
}

async function parallelizeRun(
  asyncFunction: (chapter: ApiResponse) => Promise<any>,
  parallelizationCount: number,
): Promise<any> {
  const chapters = bibleChapters();
  const promises: Promise<any>[] = [];
  async function runNext(): Promise<any> {
    const {value: chapter, done} = chapters.next();
    if (done) return undefined;
    await asyncFunction(chapter);
    return runNext();
  }
  for (let i = 0; i < parallelizationCount; i++) {
    promises.push(Promise.resolve("").then(runNext));
  }
  return Promise.all(promises);
}

export async function main(): Promise<void> {
  const result: Record<string, any> = {};

  async function process(chapter: ApiResponse) {
    for (const ref of chapter.sections.map(x => x.ref)) {
      const processedTopics: any[] = [];
      result[ref] = processedTopics;
      // eslint-disable-next-line no-await-in-loop
      const topics = await new RealRequestMaker().makeRequest<any[]>(`/ref-topic-links/${ref}`);
      topics.sort((x, y) => primacy(y) - primacy(x));
      for (const topic of topics) {
        if (topic.dataSource.slug === "sefaria-users") continue;
        if (!topic.descriptions) continue;
        processedTopics.push({
          english: topic.descriptions.en?.prompt,
          hebrew: topic.descriptions.he?.prompt,
          sourceRef: topic.descriptions.en?.title,
          sourceHeRef: topic.descriptions.he?.title,
        });
      }
    }
  }

  await parallelizeRun(process, 100);

  writeJson("precomputed/tanakh_contexts.json", result);
}

abstract class PromptRequester {
  abstract executePrompt(prompt: string, logger: Logger): Promise<any>;

  abstract name(): string;
}

class LanguageModel {
  constructor(private readonly promptRequester: PromptRequester) {}

  async makeRequest(prompt: string, logger: Logger): Promise<any> {
    const response = await this.promptRequester.executePrompt(prompt, logger);
    if (response === undefined) return undefined;

    if (typeof response !== "string") return response;

    try {
      return JSON.parse(response);
    } catch (e: any) {
      logger.error("Invalid json", response);
      if (e.toString().includes("at position")) {
        const position = parseInt(e.toString().split("at position")[1]);
        logger.error(">>", response.slice(position, position + 1));
      }
      return undefined;
    }
  }
}

export class Gemini extends PromptRequester {
  constructor(readonly model: GenerativeModel) { super(); }

  async modelRequest(prompt: string, logger: Logger): Promise<GenerateContentResult | undefined> {
    try {
      return this.model.generateContent(prompt);
    } catch (e) {
      logger.error(e);
      return undefined;
    }
  }

  async executePrompt(prompt: string, logger: Logger): Promise<string | undefined> {
    const result = await this.modelRequest(prompt, logger);
    const json = result?.response?.text();
    return json === "" ? undefined : json;
  }

  name(): string {
    return this.model.model.replace(/^models\//, "");
  }

  static flash1_5(): Gemini { // eslint-disable-line camelcase
    const GEMINI_API_KEY = checkNotUndefined(process.env.GEMINI_API_KEY, "GEMINI_API_KEY");
    const modelConfiguration = new GoogleGenerativeAI(GEMINI_API_KEY).getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        candidateCount: 1, // More than 1 is not available for Flash
        temperature: .4,
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            required: ["ref", "surroundingContext", "english", "hebrew"],
            properties: {
              ref: {type: SchemaType.STRING, description: "The <book> <chapter>:<verse> provided."},
              english: {type: SchemaType.STRING, description: "The context of the verse in English"},
              hebrew: {type: SchemaType.STRING, description: "The context of the verse in Hebrew"},
              surroundingContext: {
                type: SchemaType.OBJECT,
                description: "Any relevant surrounding context that is useful to understand the how/why of the verse",
                required: ["english", "hebrew"],
                properties: {
                  english: {type: SchemaType.STRING, description: "The surrounding context of the verse in English"},
                  hebrew: {type: SchemaType.STRING, description: "The surrounding context of the verse in Hebrew"},

                },
              },

            },
          },
        },
      },
      safetySettings: [{
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_NONE,
      }],
    });

    return new Gemini(modelConfiguration);
  }
}

/*
export class OpenAi extends PromptRequester {
  private client = new OpenAiApi();

  constructor(readonly model: string) { super(); }

  name(): string {
    return this.model;
  }

  async executePrompt(prompt: string, logger: Logger): Promise<any | undefined> {
    const ReturnType = z.object({outer: z.array(z.object({
      ref: z.string(),
      english: z.string(),
      hebrew: z.string(),
      surroundingContext: z.object({
        english: z.string(),
        hebrew: z.string(),
      }),
    }))});
    for (let i = 0; true; i++) { // eslint-disable-line no-constant-condition
      try {
         // eslint-disable-next-line no-await-in-loop
        const response = await this.client.chat.completions.create({
          messages: [{ role: 'user', content: prompt }],
          model: this.model,
          response_format: zodResponseFormat(ReturnType, "foo"),
        });

        const {content} = response.choices[0].message;
        if (!content) return undefined;
        return JSON.parse(content).outer;
      } catch (e: any) {
        if (e.message.startsWith("429 Rate limit")) {
          logger.debug("Delaying due to rate limitting.");
          await timeoutPromise(60_000); // eslint-disable-line no-await-in-loop
          continue;
        }
        throw e;
      }
    }
  }
}
*/

function chapterPrompt(chapter: ApiResponse): string {
  /* eslint-disable max-len */
  return [
    `You are a Hebrew Bible scholar and teacher. Below is ${chapter.title}.`,
    "Each element of the array is a verse in sequential order. Please provide a ",
    "brief heading in English and Hebrew for each verse which summarizes the context/topic of what is discussed. Draw in context from",
    "the surrounding verses (and your knowledge about the book and surrounding chapters, when ",
    "necessary) to provide the heading. Prefer brevity and conciseness over being elaborate; but remain clear if the heading would otherwise be vague.",
    "When the subject of a verse is not obvious from itself, or when it describes a particular case/setting which is not obvious from the verse itself, include the \"longer\" nested object that provides more detail.",
    // "The key here is that when the verse is vague on its own, the heading should assist.",
    "\n",
    "When multiple verses are part of a logical group, prefer to use the same heading.",
    "Each verse should have a heading.",
    "\n",
    "Here is the data:",
    "\n",
    "```json",
    "\n",
    JSON.stringify(chapter.sections.map(verse => {
      return {
        verse: verse.ref,
        english: verse.en,
        hebrew: verse.he,
      };
    })),
    "\n",
    "```",
    /*
    "\n",
    "When formulating your answer, consider this partial example:",
    "\n",
    "```json",
    "\n",
    /*
    `[{verse:"Numbers 6:9",english:"If someone dies suddenly nearby, defiling the consecrated hair, the [nazirite] shall shave the head at the time of becoming pure, shaving it on the seventh day.",hebrew:"וְכִֽי־יָמ֨וּת מֵ֤ת עָלָיו֙ בְּפֶ֣תַע פִּתְאֹ֔ם וְטִמֵּ֖א רֹ֣אשׁ נִזְר֑וֹ וְגִלַּ֤ח רֹאשׁוֹ֙ בְּי֣וֹם טׇהֳרָת֔וֹ בַּיּ֥וֹם הַשְּׁבִיעִ֖י יְגַלְּחֶֽנּוּ׃"},{verse:"Numbers 6:10",english:"On the eighth day that person shall bring two turtledoves or two pigeons to the priest, at the entrance of the Tent of Meeting.",hebrew:"וּבַיּ֣וֹם הַשְּׁמִינִ֗י יָבִא֙ שְׁתֵּ֣י תֹרִ֔ים א֥וֹ שְׁנֵ֖י בְּנֵ֣י יוֹנָ֑ה אֶ֨ל־הַכֹּהֵ֔ן אֶל־פֶּ֖תַח אֹ֥הֶל מוֹעֵֽד׃"},{verse:"Numbers 6:11",english:"The priest shall offer one as a sin offering and the other as a burnt offering, and make expiation on the person’s behalf for the guilt incurred through the corpse. That same day the head shall be reconsecrated;",hebrew:"וְעָשָׂ֣ה הַכֹּהֵ֗ן אֶחָ֤ד לְחַטָּאת֙ וְאֶחָ֣ד לְעֹלָ֔ה וְכִפֶּ֣ר עָלָ֔יו מֵאֲשֶׁ֥ר חָטָ֖א עַל־הַנָּ֑פֶשׁ וְקִדַּ֥שׁ אֶת־רֹאשׁ֖וֹ בַּיּ֥וֹם הַהֽוּא׃"}]`,
    "\n",
    "Understanding the purpose of the offering in verse 6:10 requires going back to 6:9 to understand why the Nazirite is defiled and bringing a purification offering. So a good potential response would be:",
    `[{verse: "Numbers 6:9", english: "The Nazirite's Defilement by a corpse", hebrew: "טומאת הנזיר ממת"},{verse: "Numbers 6:10", english: "The Offering brought by a Nazirite after Defilement by a corpse", hebrew: "הקרבן שנזיר מביא שנטמא ממת"}, {verse: "Numbers 6:11", english: "The Preist's offering of a Nazirite's sacrifices after being defiled by a corpse.", hebrew: "הקרבת קרבן הנזיר שנטצא ממת"}]`,
    */
  ].join("");
  /* eslint-enable max-len */
}

export async function llmMain(): Promise<void> {
  const requester = Gemini.flash1_5();
  // const requester = new OpenAi("gpt-4o-mini");
  const model = new LanguageModel(requester);

  const result: Record<string, any> = {errors: []};
  await parallelizeRun(
    async function runLlm(chapter) { // eslint-disable-line prefer-arrow-callback
      // if (chapter.title !== "Numbers 6") return;
      console.log(chapter.title); // eslint-disable-line no-console
      const prompt = chapterPrompt(chapter);

      try {
        const response: any[] = await model.makeRequest(prompt, new ConsoleLogger());
        for (const verse of response) {
          result[verse.ref] = verse;
        }
      } catch (e: any) {
        result.errors.push(chapter.title);
        for (const verse of chapter.sections) {
          result[verse.ref] = e.message;
        }
      }
    }, 100);
  writeJson(`precomputed/tanakh_contexts_${requester.name()}.json`, result);
}

// llmMain();
