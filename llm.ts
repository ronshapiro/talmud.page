import {GoogleGenerativeAI} from "@google/generative-ai";
import {ApiResponse} from "./apiTypes";
import {hebrewSearchRegex} from "./hebrew";
import {checkNotUndefined} from "./js/undefined";

const VAGOMER = checkNotUndefined(hebrewSearchRegex("(וגו[׳'])", true));
const API_KEY = checkNotUndefined(process.env.GEMINI_API_KEY);
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

async function makeRequest(
  hebrew: string, ref: string, allVerses: AllVerses,
): Promise<string | undefined> {
  const prompt = [
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
    "Here is an example:\n",
    "{",
    '  ref: "Nedarim 45a:4",',
    `  hebrew: "${SAMPLE_HEBREW_INPUT}",`,
    `  verses: [${SAMPLE_VERSES}]`,
    "}",
    "\n",
    "Should return:\n",
    "{",
    '  ref: "Nedarim 45a:4",',
    `  hebrew: "${SAMPLE_HEBREW_OUTPUT}"`,
    "}",
    "\n",
    "Here is the example I want you to amend:",
    "\n",
    JSON.stringify({ref, hebrew, verses: allVerses}),
    "\n",
    "Your output should be valid JSON.",
  ];


  let json = (await model.generateContent(prompt.join("")))?.response?.text();
  if (json === "") {
    console.log(">>>>>>>", ref, "empty response <<<<<<<<<<");
    return undefined;
  }
  console.log("^^^^^^^^^^^", ref);
  if (!json) return undefined;
  if (json && json.startsWith("```json") && json.endsWith("```")) {
    json = json.slice(7, -3)
  }
  if (json) {
    const parsed = JSON.parse(json); // do not submit: check parse
    if (parsed.hebrew === hebrew) console.log("!!!!!!!!! same\n\n");
    return parsed.hebrew;
  }
  return undefined;
}

export async function vagomer(response: ApiResponse): Promise<ApiResponse> {
  const allVerses = [];
  for (const section of response.sections) {
    if (section.commentary?.Verses) {
      for (const comment of section.commentary.Verses.comments) {
        allVerses.push({hebrew: comment.he, originatesFrom: section.ref});
      }
    }
  }

  for (const section of response.sections) {
    const hebrew = section.he as string;
    if (hebrew.search(VAGOMER) === -1) continue;

    const modelResponse = await makeRequest(hebrew, section.ref, allVerses);
    if (modelResponse) {
      // do not submit: strip trope and also {ס}
      // do not submit: test that if the completions are removed, the text should be unchanged.
      section.he = modelResponse;
    }
  }
  return response;
}
