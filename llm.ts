import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerateContentResult,
  SchemaType,
} from "@google/generative-ai";
import {ApiResponse} from "./apiTypes";
import {hebrewSearchRegex, stripHebrewNonlettersOrVowels, stripTanakhGapIndicators} from "./hebrew";
import {checkNotUndefined} from "./js/undefined";
import {sefariaTextTypeTransformation} from "./sefariaTextType";
import {Logger} from "./logger";

const VAGOMER = checkNotUndefined(hebrewSearchRegex("(וגו[׳'])", true));
const GEMINI_API_KEY = checkNotUndefined(process.env.GEMINI_API_KEY, "GEMINI_API_KEY");

type AllVerses = any; // do not submit

const HEBREW_TEXT_PREFIX = "אהלן אחי"
const HEBREW_VERSE_1 = "כִּי מֵתוּ כׇּל הָאֲנָשִׁים"
const HEBREW_VERSE_1_CONTINUATION = "הַמְבַקשִׁים אֶת־נַפְשֶׁךָ"
const HEBREW_TEXT_INFIX_1 = "מה התחזית היום";
const HEBREW_VERSE_2 = "בְּמַחֲשַׁכִּים הוֹשִׁיבַנִי"
const HEBREW_VERSE_2_CONTINUATION = "כְּמֵתֵי עוֹלָם";
const HEBREW_TEXT_INFIX_2 = "טוביה הגדול הנורא";
// Helps when quoted text ends with a hyphen.
const HEBREW_VERSE_3 = "לֻחֹת הָעֵדֻת בְּיַד"
const HEBREW_VERSE_3_CONTINUATION = "־מֹשֶׁה בְּרִדְתּוֹ מִן־הָהָר";
const HEBREW_TEXT_INFIX_3 = "טוביה הגדול הנורא";
// Helps when quoted text ends with a hyphen.
const HEBREW_VERSE_4 = "לֹא־תֹאכַל"
const HEBREW_VERSE_4_CONTINUATION = "עָלָיו חָמֵץ שִׁבְעַת יָמִים תֹּאכַל־עָלָיו מַצּוֹת לֶחֶם עֹנִי כִּי בְחִפָּזוֹן יָצָאתָ מֵאֶרֶץ מִצְרַיִם לְמַ֣עַן תִּזְכֹּר אֶת־יוֹם צֵֽאתְךָ מֵאֶרֶץ מִצְרַיִם כֹּל יְמֵי חַיֶּיךָ׃";

const HEBREW_TEXT_SUFFIX = "איך נדע?";
const SAMPLE_HEBREW_INPUT = [
  `${HEBREW_TEXT_PREFIX} ״${HEBREW_VERSE_1}״ וגו' `,
  `${HEBREW_TEXT_INFIX_1} `,
  `״${HEBREW_VERSE_2}״ וגו׳. `,
  `${HEBREW_TEXT_INFIX_2} `,
  `״${HEBREW_VERSE_3}״ וגו' `,
  `${HEBREW_TEXT_INFIX_3} `,
  `״${HEBREW_VERSE_4} וגו׳״ `,
  `${HEBREW_TEXT_SUFFIX}`,

].filter(x => !x.includes("span")).join("");
const SAMPLE_HEBREW_OUTPUT = [
  `${HEBREW_TEXT_PREFIX} ״${HEBREW_VERSE_1}״ וגו' `,
  `<span="vagomer-completion">${HEBREW_VERSE_1_CONTINUATION}</span> `,
  `${HEBREW_TEXT_INFIX_1} `,
  `״${HEBREW_VERSE_2}״ וגו׳ `,
  // note the change in period location.
  `<span="vagomer-completion">${HEBREW_VERSE_2_CONTINUATION}</span>. `,
  `${HEBREW_TEXT_INFIX_2} `,
  `״${HEBREW_VERSE_3}״ וגו' `,
  `<span="vagomer-completion">${HEBREW_VERSE_3_CONTINUATION}</span>. `,
  `${HEBREW_TEXT_INFIX_3} `,
  `״${HEBREW_VERSE_4} וגו׳״ `,
  `<span="vagomer-completion">${HEBREW_VERSE_4_CONTINUATION}</span>. `,
  `${HEBREW_TEXT_SUFFIX}`,

].join("");
// TODO: it would be good to add examples of typos, and/or vav and yud being spliced in.
const SAMPLE_VERSES = JSON.stringify([
  {hebrew: "בְּמַחֲשַׁכִּים הוֹשִׁיבַנִי אֶת־נַפְשֶׁךָ", originatesFrom: "Nedarim 45a:1"},
  {hebrew: "וַתֵּ֣רֶא רָחֵ֗ל כִּ֣י לֹ֤א יָֽלְדָה֙", originatesFrom: "Nedarim 45a:2"},
  {hebrew: "בְּמַחֲשַׁכִּים הוֹשִׁיבַנִי כְּמֵתֵי עוֹלָם", originatesFrom: "Nedarim 45a:4"},
  {hebrew: "וַיֹּ֨אמֶר יְהֹוָ֤ה אֶל־מֹשֶׁה֙ בְּמִדְיָ֔ן לֵ֖ךְ שֻׁ֣ב מִצְרָ֑יִם כִּי־מֵ֙תוּ֙ כׇּל־הָ֣אֲנָשִׁ֔ים הַֽמְבַקְשִׁ֖ים אֶת־נַפְשֶֽׁךָ", originatesFrom: "Nedarim 45a:4"},
  {hebrew: "וַיֵּצֵא֙ בַּיּ֣וֹם הַשֵּׁנִ֔י וְהִנֵּ֛ה שְׁנֵֽי־אֲנָשִׁ֥ים עִבְרִ֖ים נִצִּ֑ים וַיֹּ֙אמֶר֙ לָֽרָשָׁ֔ע לָ֥מָּה תַכֶּ֖ה רֵעֶֽךָ׃", originatesFrom: "Nedarim 45a:4"},
  {hebrew: "בְּמַחֲשַׁכִּים הוֹשִׁיבַנִי לֹ֥א תִתֵּ֖ן מִכְשֹׁ֑ל", originatesFrom: "Nedarim 45a:5"},
]);

function makePrompt(hebrew: string, ref: string, allVerses: AllVerses): string {
  return [
    "Below is a JSON structure representing Hebrew text that contains the phrase וגו׳ or וגו'.",
    "When that word occurs (sometimes within the quotation, sometimes directly after), it means that a biblical verse is quoted partially and that the verse ",
    "should be completed. The authors expected that the reader knows all biblical verses by ",
    "heart, but that's for experts. Instead, I'd like to complete it for them, wrapped in a ",
    '<span class="vagomer-completion"> tag.\n',
    "I've supplied a list of candidate verses in the JSON structure. If there are multiple ",
    "candidates that you're considering, use the one that is closest to the ref/Ref listed here,",
    "where proximity is measured by first trying to get an exact match before the colon, with the ",
    "tiebreaker being a numerical comparison of the number after the colon. The ref of the source ",
    "verses can be found in the verses.originatesFrom fields. Do not include the verses array in ",
    "final answer. If you don't have any changes to make, return empty text.",
    "\n",
    /*
    "One other note: sometimes the prefix of the verse that is quoted will have slight ",
    "emendations, usually in the form of the letters ו or י being introduced instead of vowels, ",
    "or simply just a typo or two. When you rewrite, keep the original emendations.",
    "\n",
    */
    /*
    "Sometimes the verse quotation may have some slight changes from the original text, usually ",
    "of the form of the letters ו or י being introduced instead of vowels, ",
    "or simply just a typo or two. ",
    "\n",
    */
    "Whenever you detect a quotation, include the entire rest of the verse right after the ",
    "corresponding instance of וגו.",
    "\n",
    "Here is an example:",
    "\n{",
    '\n  ref: "Nedarim 45a:4",',
    `\n  hebrew: "${SAMPLE_HEBREW_INPUT}",`,
    `\n  verses: [${SAMPLE_VERSES}]`,
    "\n}",
    "\n",
    "Should return:\n",
    "\n{",
    '\n  ref: "Nedarim 45a:4",',
    `\n  hebrew: "${SAMPLE_HEBREW_OUTPUT}"`,
    "\n}",
    "\n",
    "Your output should be valid JSON.",
    "\n",
    "Here is the example I want you to amend:",
    "\n",
    JSON.stringify({ref, hebrew, verses: allVerses}),
  ].join("");
}

abstract class LanguageModel {
  async makeRequest(
    hebrew: string, ref: string, allVerses: AllVerses, logger: Logger,
  ): Promise<string | undefined> {
    const prompt = makePrompt(hebrew, ref, allVerses);
    const response = await this.executePrompt(prompt, ref, logger);
    if (response === undefined) return undefined;

    try {
      return JSON.parse(response).hebrew;
    } catch (e: any) {
      logger.error("Invalid json", response);
      if (e.toString().includes("at position")) {
        const position = parseInt(e.toString().split("at position")[1]);
        logger.error(">>", response.slice(position, position + 1));
      }
      return undefined;
    }
  }

  abstract executePrompt(
    prompt: string, ref: string, logger: Logger,
  ): Promise<string | undefined>;
}

class Gemini extends LanguageModel {
  constructor(readonly model: GenerativeModel) { super(); }

  async modelRequest(prompt: string, logger: Logger): Promise<GenerateContentResult | undefined> {
    try {
      return this.model.generateContent(prompt);
    } catch (e) {
      logger.error(e);
      return undefined;
    }
  }

  async executePrompt(
    prompt: string, ref: string, logger: Logger,
  ): Promise<string | undefined> {
    const result = await this.modelRequest(prompt, logger);
    const json = result?.response?.text();
    return json === "" ? undefined : json;
  }
}

class Jamba extends LanguageModel {
  constructor(readonly modelName: string) { super(); }

  async executePrompt(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    prompt: string, ref: string, logger: Logger,
  ): Promise<string | undefined> {
    const [systemPrompt, userPrompt] = prompt.split(/Here is the example/);
    const response = await fetch("https://api.ai21.com/studio/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer 41ZdeuFSEg7cc6Dt4a0fJwKAwdnrIJdG", // do not submit api key
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          {role: "system", content: systemPrompt},
          {role: "user", content: "Here is the example" + userPrompt},
        ],
        temperature: 0.4,
        top_p: .5,
        response_format: {type: "json_object"},
      }),
    });
    const result = await response?.json();
    return result.choices[0].message.content;
  }
}

function cleanVerseTextBase(hebrew: string): string {
  hebrew = stripTanakhGapIndicators(hebrew);
  hebrew = stripHebrewNonlettersOrVowels(hebrew);
  if (hebrew.endsWith(":") || hebrew.endsWith("׃")) {
    hebrew = hebrew.slice(0, -1);
  }
  return hebrew;
}
const cleanVerseText = sefariaTextTypeTransformation(cleanVerseTextBase);

const languageModel = (() => {
  if (Math.random() === .12345678901234) return new Jamba("jamba-1.5-mini");

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    generationConfig: {
      candidateCount: 1, // More than 1 is not available for Flash
      temperature: .4,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          ref: {type: SchemaType.STRING, description: "The ref value provided in the input."},
          hebrew: {type: SchemaType.STRING, description: "The rewritten text"},
        },
      },
    },
  });
  return new Gemini(model);
})();

export async function vagomer(response: ApiResponse, logger: Logger): Promise<ApiResponse> {
  const allVerses = [];
  for (const section of response.sections) {
    if (section.commentary?.Verses) {
      for (const comment of section.commentary.Verses.comments) {
        // do not submit: need to handle non-single verses
        allVerses.push({hebrew: cleanVerseText(comment.he), originatesFrom: section.ref});
      }
    }
  }

  const promises: Promise<any>[] = [];
  for (const section of response.sections) {
    const hebrew = section.he as string;
    if (hebrew.search(VAGOMER) === -1) continue;

    const promise = languageModel.makeRequest(hebrew, section.ref, allVerses, logger)
      .then(modelResponse => {
        if (modelResponse) {
          // do not submit: test that if the completions are removed, the text should be unchanged.
          section.he = modelResponse;
        }
        return "done";
      });
    promises.push(promise);
  }
  const promiseResults = await Promise.allSettled(promises);
  for (const result of promiseResults) {
    if (result.status === "rejected") logger.error(result.reason);
  }
  return response;
}
