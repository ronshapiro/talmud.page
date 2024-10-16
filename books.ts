import {QueryGuesses} from "./apiTypes";
import {numericLiteralAsInt} from "./hebrew";
import {SIDDUR_REFS_ASHKENAZ, SIDDUR_REFS_SEFARD, BIRKAT_HAMAZON_REFS, RefPiece} from "./siddur";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const levenshteinEditDistance = require("levenshtein-edit-distance");

const ALL_HEBREW_LETTERS = ((): RegExp => {
  const hundreds = "ק"; // there are no masechtot with more than 200 dapim
  const tens = "[יכלמנסעפצ]";
  const ones = "[א-ט]";
  return new RegExp(`^(?=.+)${hundreds}?${tens}?${ones}?$`);
})();


function dafWithoutAlephOrBet(amud: string): string | undefined {
  if (/^\d+$/.test(amud)) {
    return amud;
  } else if (ALL_HEBREW_LETTERS.test(amud)) {
    return numericLiteralAsInt(amud).toString();
  }
  return undefined;
}

export function nextAmud(amud: string): string {
  const prefix = amud.slice(0, -1);
  if (amud.slice(-1) === "a") {
    return `${prefix}b`;
  }
  return `${parseInt(prefix) + 1}a`;
}

export function previousAmud(amud: string): string {
  const prefix = amud.slice(0, -1);
  if (amud.slice(-1) === "b") {
    return `${prefix}a`;
  }
  return `${parseInt(prefix) - 1}b`;
}

interface BookConstructorParams {
  canonicalName: string;
  hebrewName: string;
  aliases: string[];
  start: string;
  end: string;
  sections: string[];
}

export abstract class Book {
  canonicalName: string;
  hebrewName: string;
  aliases: string[];
  start: string;
  end: string;
  sections: Set<string>;

  constructor({
    canonicalName,
    hebrewName,
    aliases,
    start,
    end,
    sections,
  }: BookConstructorParams) {
    this.canonicalName = canonicalName;
    this.hebrewName = hebrewName;
    this.aliases = [hebrewName].concat(aliases);
    this.start = start;
    this.end = end;
    this.sections = new Set(sections);
  }

  doesSectionExist(section: string): boolean {
    return this.sections.has(section);
  }

  abstract nextPage(page: string): string;
  abstract previousPage(page: string): string;
  abstract arePagesInReverseOrder(start: string, end: string): boolean;

  isTalmud(): boolean {
    return false;
  }

  isBibleBook(): boolean {
    return false;
  }

  isMishna(): boolean {
    return false;
  }

  sectionWord(): string {
    return "section";
  }

  bookNameForRef(): string {
    return this.canonicalName;
  }

  rewriteSectionRef(section: string): string {
    return section;
  }

  toString(): string {
    return `${this.bookType()}[${this.canonicalName}]`;
  }

  abstract bookType(): string;
}

class SyntheticBook extends Book {
  constructor(name: string) {
    super({
      canonicalName: name,
      hebrewName: name,
      aliases: [],
      start: "n/a",
      end: "n/a",
      sections: [],
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  doesSectionExist(section: string): boolean {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  nextPage(page: string): string {
    throw new Error("Not implemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  previousPage(page: string): string {
    throw new Error("Not implemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  arePagesInReverseOrder(start: string, end: string): boolean {
    throw new Error("Not implemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  rewriteSectionRef(section: string): string {
    return section;
  }

  toString(): string {
    return `${this.bookType()}[${this.canonicalName}]`;
  }

  bookType(): string {
    return this.canonicalName;
  }
}


function amudim(start: string, end: string): string[] {
  const result = [];
  let current = start;
  while (current !== end) {
    result.push(current);
    current = nextAmud(current);
  }
  result.push(end);
  return result;
}

interface TalmudMasechetConstructorParams extends Omit<BookConstructorParams, "sections" | "start"> {
  // https://bit.ly/vocalized-masechet-names
  vocalizedHebrewName: string;
  start?: string;
}

export class TalmudMasechet extends Book {
  vocalizedHebrewName: string;

  constructor(params: TalmudMasechetConstructorParams) {
    const start = params.start ?? "2a";
    super({
      ...params,
      start,
      sections: amudim(start, params.end),
    });
    this.vocalizedHebrewName = params.vocalizedHebrewName;
  }

  nextPage(page: string): string {
    return nextAmud(page);
  }

  previousPage(page: string): string {
    return previousAmud(page);
  }

  arePagesInReverseOrder(start: string, end: string): boolean {
    const startNumber = parseInt(start.slice(0, -1));
    const endNumber = parseInt(end.slice(0, -1));

    return startNumber > endNumber
      || (startNumber === endNumber && start.slice(-1) === "b" && end.slice(-1) === "a");
  }


  bookType(): string {
    return "Masechet";
  }

  isTalmud(): boolean {
    return true;
  }

  sectionWord(): string {
    return "masechet";
  }
}

interface YerushalmiMasechetConstructorParams extends TalmudMasechetConstructorParams {
  refRewriting: Record<string, string>;
}

export class YerushalmiMasechet extends TalmudMasechet {
  refRewriting: Record<string, string>;

  constructor(params: YerushalmiMasechetConstructorParams) {
    super(params);
    this.refRewriting = params.refRewriting;
  }

  bookNameForRef(): string {
    return `Jerusalem Talmud ${this.canonicalName}`;
  }

  rewriteSectionRef(section: string): string {
    return this.refRewriting[section];
  }
}

type BibleBookConstructorParams = Omit<BookConstructorParams, "start" | "sections">

function chapterSections(end: number): string[] {
  const result = [];
  for (let i = 1; i <= end; i++) {
    result.push(i.toString());
  }
  return result;
}

interface MishnaMasechetParams {
  canonicalName: string;
  hebrewName: string;
  aliases?: string[] | undefined;
  numChapters: number;
}

class MishnaMasechet extends Book {
  constructor(params: MishnaMasechetParams) {
    super({
      canonicalName: params.canonicalName,
      hebrewName: params.hebrewName,
      aliases: params.aliases ?? [],
      start: "1",
      end: params.numChapters.toString(),
      sections: chapterSections(params.numChapters),
    });
  }

  nextPage(page: string): string {
    return (parseInt(page) + 1).toString();
  }

  previousPage(page: string): string {
    return (parseInt(page) - 1).toString();
  }

  arePagesInReverseOrder(start: string, end: string): boolean {
    return parseInt(start) > parseInt(end);
  }

  bookType(): string {
    return "Mishna";
  }

  isMishna(): boolean {
    return true;
  }
}

class BibleBook extends Book {
  constructor(params: BibleBookConstructorParams) {
    super({
      ...params,
      start: "1",
      sections: chapterSections(parseInt(params.end)),
    });
  }

  isBibleBook(): boolean {
    return true;
  }

  nextPage(page: string): string {
    return (parseInt(page) + 1).toString();
  }

  previousPage(page: string): string {
    return (parseInt(page) - 1).toString();
  }

  arePagesInReverseOrder(start: string, end: string): boolean {
    return parseInt(start) > parseInt(end);
  }

  bookType(): string {
    return "Book";
  }
}

interface LiturgicalBookConstructorParameters {
  canonicalName: string;
  hebrewName: string;
  aliases: string[];
  sections: Record<string, RefPiece[]>;
  bookType: string;
  bookNameForRef: string;
}

class LiturgicalBook extends Book {
  private _sections: RefPiece[];
  private _bookType: string;
  private _bookNameForRef: string;

  constructor({
    canonicalName,
    hebrewName,
    aliases,
    sections,
    bookType,
    bookNameForRef,
  }: LiturgicalBookConstructorParameters) {
    super({
      canonicalName,
      hebrewName,
      aliases,
      sections: Object.keys(sections),
      start: Object.keys(sections)[0],
      end: Object.keys(sections).at(-1)!,
    });
    this._sections = Object.keys(sections);
    this._bookType = bookType;
    this._bookNameForRef = bookNameForRef;
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  nextPage(page: string): string {
    return "<disable feature>";
  }

  previousPage(page: string): string {
    return "<disable feature>";
  }

  arePagesInReverseOrder(start: string, end: string): boolean {
    throw new Error("Unused");
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */

  bookType(): string { return this._bookType; }

  bookNameForRef(): string { return this._bookNameForRef; }
}

function formatListEnglish(items: string[]): string {
  const notLast = items.slice(0, -1).join(", ");
  return `${notLast} and ${items.at(-1)}`;
}

const AMUD_ALEPH_OPTIONS = new Set(["a", "."]);
const AMUD_BET_OPTIONS = new Set(["b", ":"]);

class CanonicalizedAmud {
  singleAmud: string | undefined;
  fullDaf: string | undefined;

  constructor(singleAmud: string | undefined, fullDaf: string | undefined) {
    this.singleAmud = singleAmud;
    this.fullDaf = fullDaf;
  }

  static create(value: string): CanonicalizedAmud | undefined {
    const numberWithAb = value.match(/^(\d{1,3})ab$/);
    if (numberWithAb) {
      return new CanonicalizedAmud(undefined, numberWithAb[1]);
    }

    const _dafWithoutAlephOrBet = dafWithoutAlephOrBet(value);
    if (_dafWithoutAlephOrBet) {
      return new CanonicalizedAmud(undefined, _dafWithoutAlephOrBet);
    }

    const justNumber = dafWithoutAlephOrBet(value.slice(0, -1));
    if (!justNumber) {
      return undefined;
    }

    const lastChar = value.slice(-1);
    if (AMUD_ALEPH_OPTIONS.has(lastChar)) {
      return new CanonicalizedAmud(`${justNumber}a`, undefined);
    } else if (AMUD_BET_OPTIONS.has(lastChar)) {
      return new CanonicalizedAmud(`${justNumber}b`, undefined);
    }

    return undefined;
  }
}

export class QueryResult {
  bookName: string;
  start: string;
  end: string | undefined;

  constructor(
    bookName: string,
    start: string,
    end?: string,
  ) {
    this.bookName = bookName;
    this.start = start;
    this.end = end;
  }

  static fullDaf(bookName: string, pageNumber: string): QueryResult {
    return new QueryResult(bookName, `${pageNumber}a`, `${pageNumber}b`);
  }

  toUrlPathname(): string {
    let pathname = `/${this.bookName}/${this.start}`;
    if (this.end) {
      pathname += `/to/${this.end}`;
    }
    return pathname;
  }
}

export class InvalidQueryException extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, InvalidQueryException.prototype);
  }
}

export class UnknownBookNameException extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, UnknownBookNameException.prototype);
  }
}

abstract class RangeParser {
  abstract validate(pages: string[]): void;
  abstract createSingle(title: string, page: string): QueryResult;
  abstract createRange(title: string, start: string, end: string): QueryResult;
}

class AmudRangeParser extends RangeParser {
  validate(pages: string[]): void {
    const invalid: string[] = [];
    for (const page of pages) {
      if (!CanonicalizedAmud.create(page)) {
        invalid.push(page);
      }
    }

    switch (invalid.length) {
      case 0: {
        return;
      }
      case 1: {
        throw new InvalidQueryException(`${invalid[0]} is not a valid amud`);
      }
      default: {
        throw new InvalidQueryException(`${formatListEnglish(invalid)} are not valid amudim`);
      }
    }
  }

  createSingle(title: string, page: string): QueryResult {
    const start = CanonicalizedAmud.create(page)!;
    if (start.fullDaf) {
      return QueryResult.fullDaf(title, start.fullDaf);
    } else {
      return new QueryResult(title, start.singleAmud!);
    }
  }

  createRange(title: string, _start: string, _end: string): QueryResult {
    const start = CanonicalizedAmud.create(_start)!;
    const end = CanonicalizedAmud.create(_end)!;

    const startAmud = start.fullDaf ? `${start.fullDaf}a` : start.singleAmud!;
    const endAmud = end.fullDaf ? `${end.fullDaf}b` : end.singleAmud!;

    return new QueryResult(title, startAmud, endAmud);
  }
}

class ChapterRangeParser extends RangeParser {
  validate(pages: string[]): void {
    const invalid = pages.filter(x => parseInt(x).toString() !== x);
    switch (invalid.length) {
      case 0: {
        return;
      }
      case 1: {
        throw new InvalidQueryException(`${invalid[0]} is not a number`);
      }
      default: {
        throw new InvalidQueryException(`${formatListEnglish(invalid)} are not numbers`);
      }
    }
  }

  createSingle(title: string, page: string): QueryResult {
    return new QueryResult(title, page);
  }

  createRange(title: string, start: string, end: string): QueryResult {
    return new QueryResult(title, start, end);
  }
}

const AMUD_RANGE_SEPARATORS = new Set(["to", "-"]);

export class BookIndex {
  byCanonicalName: Record<string, Book> = {};
  aliasIndex: Record<string, string> = {};

  constructor(allBooks: Book[]) {
    for (const book of allBooks) {
      this.addIndexValue(book.canonicalName, book, this.byCanonicalName);
      this.addIndexValue(book.canonicalName.toLowerCase(), book.canonicalName, this.aliasIndex);
      for (const alias of book.aliases) {
        this.addIndexValue(alias.toLowerCase(), book.canonicalName, this.aliasIndex);
      }
    }
  }

  private addIndexValue<T>(name: string, value: T, index: Record<string, T>) {
    index[name] = value;
    index[name.replace(/ /g, '_')] = value;
  }

  private canonicalNameOrUndefined(name: string): string | undefined {
    // eslint-disable-next-line no-useless-escape
    return this.aliasIndex[name.toLowerCase().replace(/['\-]/g, "")];
  }

  canonicalName(name: string): string {
    const book = this.canonicalNameOrUndefined(name);
    if (book) {
      return book;
    }
    throw new UnknownBookNameException(name);
  }

  /** Returns the `canonicalName(name)`, normalized for use in URLs. */
  canonicalUrlName(name: string): string {
    return this.canonicalName(name).replace(/ /g, "_");
  }

  doesSectionExist(name: string, section: string): boolean {
    const canonical = this.canonicalNameOrUndefined(name);
    return canonical !== undefined && this.byCanonicalName[canonical].doesSectionExist(section);
  }

  private bookGuesses(query: string): string[] {
    const results: [number, string][] = [];
    const candidates = new Set<string>();
    // const maybeBook = query.slice(0, query.lastIndexOf(" "));
    for (const book of Object.values(this.byCanonicalName)) {
      let distance = 99999;
      for (const option of [book.canonicalName].concat(book.aliases)) {
        const editDistance = levenshteinEditDistance(option, query, true);
        distance = Math.min(editDistance / option.length, distance);
      }
      if (distance <= .5 && !candidates.has(book.canonicalName)) {
        results.push([distance, book.canonicalName]);
        candidates.add(book.canonicalName);
      }
    }
    results.sort((a, b) => a[0] - b[0]);
    return results.map(x => x[1]);
  }

  parse(query: string): QueryResult {
    const result = this.parseWithGuesses(query);
    if (!(result instanceof QueryResult)) {
      throw new InvalidQueryException(`Could not find title: ${query}`);
    }
    return result;
  }

  parseWithGuesses(query: string): QueryResult | QueryGuesses {
    query = query.trim().replace(/  +/g, " ");
    let words = query.split(" ");
    let title: string | undefined;
    for (let i = 1; i <= words.length; i++) {
      title = this.canonicalNameOrUndefined(words.slice(0, i).join(" "));
      if (title) {
        words = words.slice(i);
        break;
      }
    }
    if (!title) {
      if (query.includes(" ")) {
        const possibleBook = query.slice(0, query.lastIndexOf(" "));
        const possiblePage = query.slice(query.lastIndexOf(" ") + 1);
        const bookGuesses = this.bookGuesses(possibleBook);
        if (bookGuesses.length > 0) {
          const guesses = [];
          for (const bookGuess of bookGuesses) {
            const guess = `${bookGuess} ${possiblePage}`;
            guesses.push({text: guess, url: this.parse(guess).toUrlPathname()});
          }
          return {guesses};
        }
      }
      throw new InvalidQueryException(`Could not find title: ${query}`);
    }

    const book = this.byCanonicalName[title];
    if (words.length === 0) {
      throw new InvalidQueryException(`No ${book.sectionWord()} specified in query: "${query}"`);
    }

    if (words.length === 1 && words[0].includes("-")) {
      const sections = words[0].split("-");
      if (sections.length !== 2) {
        throw new InvalidQueryException(`Could not understand: ${query}`);
      }
      words = [sections[0], "-", sections[1]];
    }

    const rangeParser = book.isTalmud() ? new AmudRangeParser() : new ChapterRangeParser();

    if (words.length === 1) {
      rangeParser.validate(words);
      return rangeParser.createSingle(title, words[0]);
    }

    if (words.length === 3 && AMUD_RANGE_SEPARATORS.has(words[1])) {
      const [start, /* separator */, end] = words;
      rangeParser.validate([start, end]);
      return rangeParser.createRange(title, start, end);
    }

    throw new InvalidQueryException(`Could not understand: ${query}`);
  }
}

export const books = new BookIndex([
  new TalmudMasechet({
    canonicalName: "Arakhin",
    hebrewName: "ערכין",
    vocalizedHebrewName: "עֲרָכִין",
    aliases: ["Arachin"],
    end: "34a",
  }),
  new TalmudMasechet({
    canonicalName: "Avodah Zarah",
    hebrewName: "עבודה זרה",
    vocalizedHebrewName: "עֲבוֹדָה זָרָה",
    aliases: ["Avoda Zarah", "Avoda Zara", "Avodah Zara"],
    end: "76b",
  }),
  new TalmudMasechet({
    canonicalName: "Bava Batra",
    hebrewName: "בבא בתרא",
    vocalizedHebrewName: "בָּבָא בָּתְרָא",
    aliases: ["Bava Basra"],
    end: "176b",
  }),
  new TalmudMasechet({
    canonicalName: "Bava Kamma",
    hebrewName: "בבא קמא",
    vocalizedHebrewName: "בָּבָא קַמָּא",
    aliases: ["Bava Kama"],
    end: "119b",
  }),
  new TalmudMasechet({
    canonicalName: "Bava Metzia",
    hebrewName: "בבא מציעא",
    vocalizedHebrewName: "בָּבָא מְצִיעָא",
    aliases: [
      "Bava Metziah", "Bava Metsia", "Bava Metsiah",
      "Bava Metsiah", "Bava Metsia", "Bava Metsiah",
    ],
    end: "119a",
  }),
  new TalmudMasechet({
    canonicalName: "Beitzah",
    hebrewName: "ביצה",
    vocalizedHebrewName: "בֵּיצָה",
    aliases: ["Beitza", "Beitsah", "Beitsa"],
    end: "40b",
  }),
  new TalmudMasechet({
    canonicalName: "Bekhorot",
    hebrewName: "בכורות",
    vocalizedHebrewName: "בְּכוֹרוֹת",
    aliases: ["Bechorot", "Bechoros", "Bekhoros"],
    end: "61a",
  }),
  new TalmudMasechet({
    canonicalName: "Berakhot",
    hebrewName: "ברכות",
    vocalizedHebrewName: "בְּרָכוֹת",
    aliases: [
      "Berachot", "Brachot", "Brakhot",
      "Berachos", "Brachos", "Brakhos", "Berakhos",
    ],
    end: "64a",
  }),
  new TalmudMasechet({
    canonicalName: "Chagigah",
    hebrewName: "חגיגה",
    vocalizedHebrewName: "חֲגִיגָה",
    aliases: ["Chagiga", "Khagigah", "Khagiga"],
    end: "27a",
  }),
  new TalmudMasechet({
    canonicalName: "Chullin",
    hebrewName: "חולין",
    vocalizedHebrewName: "חֻלִּין",
    aliases: ["Chulin", "Hulin", "Hullin"],
    end: "142a",
  }),
  new TalmudMasechet({
    canonicalName: "Eruvin",
    hebrewName: "עירובין",
    vocalizedHebrewName: "עֵירוּבִין",
    aliases: ["Eiruvin"],
    end: "105a",
  }),
  new TalmudMasechet({
    canonicalName: "Gittin",
    hebrewName: "גיטין",
    vocalizedHebrewName: "גִּיטִּין",
    aliases: ["Gitin"],
    end: "90b",
  }),
  new TalmudMasechet({
    canonicalName: "Horayot",
    hebrewName: "הוריות",
    vocalizedHebrewName: "הוֹרָיוֹת",
    aliases: ["Horayos"],
    end: "14a",
  }),
  new TalmudMasechet({
    canonicalName: "Keritot",
    hebrewName: "כריתות",
    vocalizedHebrewName: "כְּרִיתוֹת",
    aliases: [
      "Ceritot", "Kritot", "Critot",
      "Kerisos", "Cerisos", "Krisos", "Crisos",
    ],
    end: "28b",
  }),
  new TalmudMasechet({
    canonicalName: "Ketubot",
    hebrewName: "כתובות",
    vocalizedHebrewName: "כְּתֻבּוֹת",
    aliases: [
      "Ktubot",
      "Kesubos", "Ksubos",
    ],
    end: "112b",
  }),
  new TalmudMasechet({
    canonicalName: "Kiddushin",
    hebrewName: "קידושין",
    vocalizedHebrewName: "קִדּוּשִׁין",
    aliases: ["Kidushin"],
    end: "82b",
  }),
  new TalmudMasechet({
    canonicalName: "Makkot",
    hebrewName: "מכות",
    vocalizedHebrewName: "מַכּוֹת",
    aliases: [
      "Makot", "Macot", "Maccot",
      "Makos", "Macos", "Maccos", "Makkos",
    ],
    end: "24b",
  }),
  new TalmudMasechet({
    canonicalName: "Megillah",
    hebrewName: "מגילה",
    vocalizedHebrewName: "מְגִלָּה",
    aliases: ["Megilla", "Megila", "Megilah"],
    end: "32a",
  }),
  new TalmudMasechet({
    canonicalName: "Meilah",
    vocalizedHebrewName: "מְעִילָה",
    hebrewName: "מעילה",
    aliases: ["Meila"],
    end: "22a",
  }),
  new TalmudMasechet({
    canonicalName: "Menachot",
    hebrewName: "מנחות",
    vocalizedHebrewName: "מְנָחוֹת",
    aliases: ["Menakhot", "Menachos", "Menakhos"],
    end: "110a",
  }),
  new TalmudMasechet({
    canonicalName: "Moed Katan",
    hebrewName: "מועד קטן",
    vocalizedHebrewName: "מוֹעֵד קָטָן",
    aliases: ["Moed Catan"],
    end: "29a",
  }),
  new TalmudMasechet({
    canonicalName: "Nazir",
    hebrewName: "נזיר",
    vocalizedHebrewName: "נָזִיר",
    aliases: [],
    end: "66b",
  }),
  new TalmudMasechet({
    canonicalName: "Nedarim",
    hebrewName: "נדרים",
    vocalizedHebrewName: "נְדָרִים",
    aliases: [],
    end: "91b",
  }),
  new TalmudMasechet({
    canonicalName: "Niddah",
    hebrewName: "נדה",
    vocalizedHebrewName: "נִדָּה",
    aliases: ["Nidda", "Nidah", "Nida"],
    end: "73a",
  }),
  new TalmudMasechet({
    canonicalName: "Pesachim",
    hebrewName: "פסחים",
    vocalizedHebrewName: "פְּסָחִים",
    aliases: ["Pesahim"],
    end: "121b",
  }),
  new TalmudMasechet({
    canonicalName: "Rosh Hashanah",
    hebrewName: "ראש השנה",
    vocalizedHebrewName: "רֹאשׁ הַשָּׁנָה",
    aliases: ["Rosh Hashana", "Rosh Hoshona", "Rosh Hoshonah", "RH"],
    end: "35a",
  }),
  new TalmudMasechet({
    canonicalName: "Sanhedrin",
    hebrewName: "סנהדרין",
    vocalizedHebrewName: "סַנהֶדרִין",
    aliases: [],
    end: "113b",
  }),
  new TalmudMasechet({
    canonicalName: "Shabbat",
    hebrewName: "שבת",
    vocalizedHebrewName: "שַׁבָּת",
    aliases: [
      "Shabat", "Chabbat", "Chabat",
      "Shabos", "Chabbos", "Chabos",
      "Shabbas", "Shabbos",
    ],
    end: "157b",
  }),
  new YerushalmiMasechet({
    canonicalName: "Shekalim",
    hebrewName: "שקלים",
    vocalizedHebrewName: "שְׁקָלִים",
    aliases: [
      "Yerushalmi Shekalim",
    ],
    end: "22b",
    refRewriting: {
      "2a": "1.1.1-16",
      "2b": "1.1.16-35",
      "3a": "1.1.35-2.13",
      "3b": "1.2.13-4.3",
      "4a": "1.4.3-22",
      "4b": "1.4.22-35",
      "5a": "1.4.35-2.1.13",
      "5b": "2.1.13-3.1",
      "6a": "2.3.1-4.1",
      "6b": "2.4.1-23",
      "7a": "2.4.23-5.10",
      "7b": "2.5.10-3.1.11",
      "8a": "3.1.11-2.5",
      "8b": "3.2.5-21",
      "9a": "3.2.21-3.5",
      "9b": "3.3.5-4.1.2",
      "10a": "4.1.2-2.1",
      "10b": "4.2.1-15",
      "11a": "4.2.15-3.4",
      "11b": "4.3.4-4.1",
      "12a": "4.4.1-22",
      "12b": "4.4.22-42",
      "13a": "4.4.42-5.1.10",
      "13b": "5.1.10-30",
      "14a": "5.1.30-58",
      "14b": "5.1.58-3.8",
      "15a": "5.3.8-4.18",
      "15b": "5.4.18-6.1.14",
      "16a": "6.1.14-34",
      "16b": "6.1.34-2.1",
      "17a": "6.2.1-32",
      "17b": "6.2.32-3.14",
      "18a": "6.3.14-4.11",
      "18b": "6.4.11-31",
      "19a": "6.4.31-7.2.5",
      "19b": "7.2.5-18",
      "20a": "7.2.18-3.13",
      "20b": "7.3.13-39",
      "21a": "7.3.39-8.1.6",
      "21b": "8.1.6-3.2",
      "22a": "8.3.2-4.12",
      "22b": "8.4.12-15",
    },
  }),
  new TalmudMasechet({
    canonicalName: "Shevuot",
    hebrewName: "שבועות",
    vocalizedHebrewName: "שְׁבוּעוֹת",
    aliases: ["Shevuos"],
    end: "49b",
  }),
  new TalmudMasechet({
    canonicalName: "Sotah",
    hebrewName: "סוטה",
    vocalizedHebrewName: "סוֹטָה",
    aliases: ["Sota", "Sottah", "Sotta"],
    end: "49b",
  }),
  new TalmudMasechet({
    canonicalName: "Sukkah",
    hebrewName: "סוכה",
    vocalizedHebrewName: "סֻכָּה",
    aliases: ["Sukka", "Suka", "Succah", "Succa"],
    end: "56b",
  }),
  new TalmudMasechet({
    canonicalName: "Taanit",
    hebrewName: "תענית",
    vocalizedHebrewName: "תַּעֲנִית",
    aliases: ["Taanit", "Taanis", "Tanit", "Tanis"],
    end: "31a",
  }),
  new TalmudMasechet({
    canonicalName: "Tamid",
    hebrewName: "תמיד",
    vocalizedHebrewName: "תָּמִיד",
    aliases: ["Tammid"],
    start: "25b",
    end: "33b",
  }),
  new TalmudMasechet({
    canonicalName: "Temurah",
    hebrewName: "תמורה",
    vocalizedHebrewName: "תְּמוּרָה",
    aliases: ["Temura"],
    end: "34a",
  }),
  new TalmudMasechet({
    canonicalName: "Yevamot",
    hebrewName: "יבמות",
    vocalizedHebrewName: "יְבָמוֹת",
    aliases: ["Yevamos"],
    end: "122b",
  }),
  new TalmudMasechet({
    canonicalName: "Yoma",
    hebrewName: "יומא",
    vocalizedHebrewName: "יוֹמָא",
    aliases: ["Yuma", "Yomah", "Yumah"],
    end: "88a",
  }),
  new TalmudMasechet({
    canonicalName: "Zevachim",
    hebrewName: "זבחים",
    vocalizedHebrewName: "זְבָחִים",
    aliases: ["Zvachim", "Zevakhim"],
    end: "120b",
  }),
  new BibleBook({
    canonicalName: "Genesis",
    hebrewName: "בראשית",
    aliases: ["Bereshit", "Breishit", "Bereishit", "Beresheet", "Bereshith", "Bereishis", "Gen"],
    end: "50",
  }),
  new BibleBook({
    canonicalName: "Exodus",
    hebrewName: "שמות",
    aliases: ["Shmot", "Shemot", "Shemoth", "Shemos", "Ex"],
    end: "40",
  }),
  new BibleBook({
    canonicalName: "Leviticus",
    hebrewName: "ויקרא",
    aliases: ["Vayikra", "Vayikrah", "Vay"],
    end: "27",
  }),
  new BibleBook({
    canonicalName: "Numbers",
    hebrewName: "במדבר",
    aliases: ["Bamidbar", "Bemidbar", "Num"],
    end: "36",
  }),
  new BibleBook({
    canonicalName: "Deuteronomy",
    hebrewName: "דברים",
    aliases: ["Devarim", "Dvarim", "Devorim", "Duet"],
    end: "34",
  }),
  new BibleBook({
    canonicalName: "Joshua",
    hebrewName: "יהושע",
    aliases: ["Yehoshua"],
    end: "24",
  }),
  new BibleBook({
    canonicalName: "Judges",
    hebrewName: "שופטים",
    aliases: ["Shoftim"],
    end: "21",
  }),
  new BibleBook({
    canonicalName: "I Samuel",
    hebrewName: "שמואל א",
    aliases: [
      "First Samuel", "Shmuel Aleph", "Shmuel Alef", "I Shmuel", "Samuel I", "Shmuel I",
      "1 Samuel", "I Shemuel", "I. Samuel"],
    end: "31",
  }),
  new BibleBook({
    canonicalName: "II Samuel",
    hebrewName: "שמואל ב",
    aliases: [
      "Second Samuel", "Shmuel Bet", "Shmuel II", "Samuel II", "II Shmuel", "2 Samuel",
      "II Shemuel", "II. Samuel"],
    end: "24",
  }),
  new BibleBook({
    canonicalName: "I Kings",
    hebrewName: "מלכים א",
    aliases: [
      "I Melachim", "Melachim Aleph", "Melachim Alef", "Kings I", "Melachim I", "1 Kings",
      "First Kings", "I Melakhim", "I. Kings", "מל״א",
      'מל"א'],
    end: "22",
  }),
  new BibleBook({
    canonicalName: "II Kings",
    hebrewName: "מלכים ב",
    aliases: [
      "Melachim Bet", "Melachim II", "Second Kings", "2 Kings", "II Melachim", "Kings II",
      "II Melakhim", "II. Kings", "מל״ב",
      'מל"ב'],
    end: "25",
  }),
  new BibleBook({
    canonicalName: "Isaiah",
    hebrewName: "ישעיהו",
    aliases: ["Isaia", "Yishayahu", "Yeshayahu"],
    end: "66",
  }),
  new BibleBook({
    canonicalName: "Jeremiah",
    hebrewName: "ירמיהו",
    aliases: ["Yirmiyahu", "Yirmiyohu", "Yermiyahu", "Yirmeyahu", "Jer"],
    end: "52",
  }),
  new BibleBook({
    canonicalName: "Ezekiel",
    hebrewName: "יחזקאל",
    aliases: ["Yehezkel", "Yechezkel", "Yechezkiel"],
    end: "48",
  }),
  new BibleBook({
    canonicalName: "Hosea",
    hebrewName: "הושע",
    aliases: ["Hoshea"],
    end: "14",
  }),
  new BibleBook({
    canonicalName: "Joel",
    hebrewName: "יואל",
    aliases: ["Yoel"],
    end: "4",
  }),
  new BibleBook({
    canonicalName: "Amos",
    hebrewName: "עמוס",
    aliases: [],
    end: "9",
  }),
  new BibleBook({
    canonicalName: "Obadiah",
    hebrewName: "עובדיה",
    aliases: ["Ovadiah", "Ovadyah", "Ovadia", "Ovadya"],
    end: "1",
  }),
  new BibleBook({
    canonicalName: "Jonah",
    hebrewName: "יונה",
    aliases: ["Yonah"],
    end: "4",
  }),
  new BibleBook({
    canonicalName: "Micah",
    hebrewName: "מיכה",
    aliases: ["Mikha", "Michah", "Micha"],
    end: "7",
  }),
  new BibleBook({
    canonicalName: "Nahum",
    hebrewName: "נחום",
    aliases: ["Nachum"],
    end: "3",
  }),
  new BibleBook({
    canonicalName: "Habakkuk",
    hebrewName: "חבקוק",
    aliases: ["Havakkuk", "Habakuk", "Habbakuk"],
    end: "3",
  }),
  new BibleBook({
    canonicalName: "Zephaniah",
    hebrewName: "צפניה",
    aliases: ["Tzephaniah", "Zephania", "Tzephania"],
    end: "3",
  }),
  new BibleBook({
    canonicalName: "Haggai",
    hebrewName: "חגי",
    aliases: ["Chaggai", "Hagai", "Chagai", "Chaggay", "Hagay", "Chagay"],
    end: "2",
  }),
  new BibleBook({
    canonicalName: "Zechariah",
    hebrewName: "זכריה",
    aliases: ["Zachariah", "Zekharia", "Zekharya", "Zecharia", "Zecharyah"],
    end: "14",
  }),
  new BibleBook({
    canonicalName: "Malachi",
    hebrewName: "מלאכי",
    aliases: ["Malakhi"],
    end: "3",
  }),
  new BibleBook({
    canonicalName: "Psalms",
    hebrewName: "תהילים",
    aliases: ["Tehilim", "Psalm", "Tehillim"],
    end: "150",
  }),
  new BibleBook({
    canonicalName: "Proverbs",
    hebrewName: "משלי",
    aliases: ["Mishlei", "Mishle"],
    end: "31",
  }),
  new BibleBook({
    canonicalName: "Job",
    hebrewName: "איוב",
    aliases: ["Iyov", "Iyyov"],
    end: "42",
  }),
  new BibleBook({
    canonicalName: "Song of Songs",
    hebrewName: "שיר השירים",
    aliases: [
      "Shir HaShirim", "Songs", "Shir haShirim", "Shir Hashirim", "שיה״ש",
      'שיה"ש'],
    end: "8",
  }),
  new BibleBook({
    canonicalName: "Ruth",
    hebrewName: "רות",
    aliases: ["Rut"],
    end: "4",
  }),
  new BibleBook({
    canonicalName: "Lamentations",
    hebrewName: "איכה",
    aliases: ["Eichah", "Eicha", "Eikhah", "Eikha"],
    end: "5",
  }),
  new BibleBook({
    canonicalName: "Ecclesiastes",
    hebrewName: "קהלת",
    aliases: ["Kohelet", "Koheleth"],
    end: "12",
  }),
  new BibleBook({
    canonicalName: "Esther",
    hebrewName: "אסתר",
    aliases: ["Ester", "מגילת אסתר"],
    end: "10",
  }),
  new BibleBook({
    canonicalName: "Daniel",
    hebrewName: "דניאל",
    aliases: ["Dan"],
    end: "12",
  }),
  new BibleBook({
    canonicalName: "Ezra",
    hebrewName: "עזרא",
    aliases: [],
    end: "10",
  }),
  new BibleBook({
    canonicalName: "Nehemiah",
    hebrewName: "נחמיה",
    aliases: [
      "Nehemia", "Nechemia", "Nechemiah", "Nehemya", "Nechemya", "Nechemyah",
      "Nehemiya", "Nechemiya", "Nechemiyah", "Neh",
    ],
    end: "13",
  }),
  new BibleBook({
    canonicalName: "I Chronicles",
    hebrewName: "דברי הימים א",
    aliases: [
      "1 Chronicles", "Chronicles I", "I Divrei HaYamim", "Divrei HaYamim I",
      "Divrei HaYamim Aleph", "Divrei HaYamim Alef", "First Chronicles", "I Divrei Ha-yamim",
      "I Divrei Ha-Yamim", "I Divrei Hayomim", "Divre HaYamim I", "Divrei Hayamim I",
      "דהי״א",
      'דהי"א',
    ],
    end: "29",
  }),
  new BibleBook({
    canonicalName: "II Chronicles",
    hebrewName: "דברי הימים ב",
    aliases: [
      "2 Chronicles", "II Divrei HaYamim", "Second Chronicles", "Chronicles II",
      "Divrei HaYamim II", "Divrei HaYamim Bet", "II Divrei Ha-yamim", "II Divrei Ha-Yamim",
      "II Divrei Hayomim", "Divre HaYamim II", "Divrei Hayamim II",
      "דהי״ב",
      'דהי"ב',
    ],
    end: "36",
  }),

  new MishnaMasechet({
    canonicalName: "Mishnah Berakhot",
    hebrewName: "משנה ברכות",
    aliases: ["Mishnah Brachot", "Mishnah Berachot", "Mishnah B’rakhoth"],
    numChapters: 9,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Peah",
    hebrewName: "משנה פאה",
    aliases: ["Mishnah Péah"],
    numChapters: 8,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Demai",
    hebrewName: "משנה דמאי",
    aliases: ["Mishnah D’mai"],
    numChapters: 7,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Kilayim",
    hebrewName: "משנה כלאים",
    aliases: [],
    numChapters: 9,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Sheviit",
    hebrewName: "משנה שביעית",
    aliases: ["Mishnah Sh’biith"],
    numChapters: 10,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Terumot",
    hebrewName: "משנה תרומות",
    aliases: ["Mishnah T’rumoth"],
    numChapters: 11,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Maasrot",
    hebrewName: "משנה מעשרות",
    aliases: ["Mishnah Maʿasroth"],
    numChapters: 5,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Maaser Sheni",
    hebrewName: "משנה מעשר שני",
    aliases: ["Mishnah Maʿǎser Sheni"],
    numChapters: 5,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Challah",
    hebrewName: "משנה חלה",
    aliases: ["Mishnah Ḥallah"],
    numChapters: 4,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Orlah",
    hebrewName: "משנה ערלה",
    aliases: ["Mishnah ʿOrlah"],
    numChapters: 3,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Bikkurim",
    hebrewName: "משנה ביכורים",
    aliases: ["Mishnah Biccurim"],
    numChapters: 4,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Shabbat",
    hebrewName: "משנה שבת",
    aliases: ["Mishnah Sabbath"],
    numChapters: 24,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Eruvin",
    hebrewName: "משנה עירובין",
    aliases: ["Mishnah Erubin"],
    numChapters: 10,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Pesachim",
    hebrewName: "משנה פסחים",
    aliases: ["Mishnah Pesahim", "Mishnah P’saḥim"],
    numChapters: 10,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Shekalim",
    hebrewName: "משנה שקלים",
    aliases: ["Mishnah Sh’ḳalim"],
    numChapters: 8,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Yoma",
    hebrewName: "משנה יומא",
    aliases: [],
    numChapters: 8,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Sukkah",
    hebrewName: "משנה סוכה",
    aliases: ["Mishnah Succah"],
    numChapters: 5,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Beitzah",
    hebrewName: "משנה ביצה",
    aliases: ["Mishnah Betsah"],
    numChapters: 5,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Rosh Hashanah",
    hebrewName: "משנה ראש השנה",
    aliases: ["Mishnah Rosh hash-Shanah"],
    numChapters: 4,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Ta'anit",
    hebrewName: "משנה תענית",
    aliases: ["Mishnah Taʿãnith", "Mishnah Taanit"],
    numChapters: 4,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Megillah",
    hebrewName: "משנה מגילה",
    aliases: ["Mishnah M’gillah"],
    numChapters: 4,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Moed Katan",
    hebrewName: "משנה מועד קטן",
    aliases: ["Mishnah Mo'ed Katan", "Mishnah Moʿed Ḳaṭon"],
    numChapters: 3,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Chagigah",
    hebrewName: "משנה חגיגה",
    aliases: ["Mishnah Ḥãgigah"],
    numChapters: 3,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Yevamot",
    hebrewName: "משנה יבמות",
    aliases: ["Mishnah Y’bamoth"],
    numChapters: 16,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Ketubot",
    hebrewName: "משנה כתובות",
    aliases: ["Mishnah K’thuboth"],
    numChapters: 13,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Nedarim",
    hebrewName: "משנה נדרים",
    aliases: ["Mishnah N’darim"],
    numChapters: 11,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Nazir",
    hebrewName: "משנה נזיר",
    aliases: [],
    numChapters: 9,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Sotah",
    hebrewName: "משנה סוטה",
    aliases: ["Mishnah Soṭah"],
    numChapters: 9,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Gittin",
    hebrewName: "משנה גיטין",
    aliases: ["Mishnah Giṭṭin"],
    numChapters: 9,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Kiddushin",
    hebrewName: "משנה קידושין",
    aliases: ["Mishnah Ḳiddushin"],
    numChapters: 4,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Bava Kamma",
    hebrewName: "משנה בבא קמא",
    aliases: ["Mishnah Baba Ḳamma"],
    numChapters: 10,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Bava Metzia",
    hebrewName: "משנה בבא מציעא",
    aliases: ["Mishnah Baba M’tsiʿa"],
    numChapters: 10,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Bava Batra",
    hebrewName: "משנה בבא בתרא",
    aliases: ["Mishnah Baba Bathra"],
    numChapters: 10,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Sanhedrin",
    hebrewName: "משנה סנהדרין",
    aliases: ["Mishnah Synhedrin"],
    numChapters: 11,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Makkot",
    hebrewName: "משנה מכות",
    aliases: ["Mishnah Maccoth"],
    numChapters: 3,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Shevuot",
    hebrewName: "משנה שבועות",
    aliases: ["Mishnah Shavuos", "Mishnah Shevuos", "Mishnah Shʾbuoth", "Mishnah Shevu’ot"],
    numChapters: 8,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Eduyot",
    hebrewName: "משנה עדיות",
    aliases: ["Mishnah Eduyoth"],
    numChapters: 8,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Avodah Zarah",
    hebrewName: "משנה עבודה זרה",
    aliases: ["Mishnah Abodah Zarah"],
    numChapters: 5,
  }),
  new MishnaMasechet({
    canonicalName: "Pirkei Avot",
    hebrewName: "משנה אבות",
    aliases: ["Mishnah Avot", "Mishnah Aboth"],
    numChapters: 6,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Horayot",
    hebrewName: "משנה הוריות",
    aliases: ["Mishnah Horayoth"],
    numChapters: 3,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Zevachim",
    hebrewName: "משנה זבחים",
    aliases: ["Mishnah Z’baḥim"],
    numChapters: 14,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Menachot",
    hebrewName: "משנה מנחות",
    aliases: ["Mishnah M’naḥoth"],
    numChapters: 13,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Chullin",
    hebrewName: "משנה חולין",
    aliases: ["Mishnah Ḥullin"],
    numChapters: 12,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Bekhorot",
    hebrewName: "משנה בכורות",
    aliases: ["Mishnah B’khoroth"],
    numChapters: 9,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Arakhin",
    hebrewName: "משנה ערכין",
    aliases: [],
    numChapters: 9,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Temurah",
    hebrewName: "משנה תמורה",
    aliases: ["Mishnah T’murah"],
    numChapters: 7,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Keritot",
    hebrewName: "משנה כריתות",
    aliases: ["Mishnah Keritut", "Mishnah K’rithoth"],
    numChapters: 6,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Meilah",
    hebrewName: "משנה מעילה",
    aliases: ["Mishnah M’ʿilah"],
    numChapters: 6,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Tamid",
    hebrewName: "משנה תמיד",
    aliases: [],
    numChapters: 7,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Middot",
    hebrewName: "משנה מדות",
    aliases: ["Mishnah Middoth"],
    numChapters: 5,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Kinnim",
    hebrewName: "משנה קינים",
    aliases: ["Mishnah Ḳinnim"],
    numChapters: 3,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Kelim",
    hebrewName: "משנה כלים",
    aliases: ["Mishnah Keilim"],
    numChapters: 30,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Oholot",
    hebrewName: "משנה אהלות",
    aliases: ["Mishnah Ohalot"],
    numChapters: 18,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Negaim",
    hebrewName: "משנה נגעים",
    aliases: ["Mishnah N’gaʿim"],
    numChapters: 14,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Parah",
    hebrewName: "משנה פרה",
    aliases: [],
    numChapters: 12,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Tahorot",
    hebrewName: "משנה טהרות",
    aliases: ["Mishnah Taharot", "Mishnah Tohãroth"],
    numChapters: 10,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Mikvaot",
    hebrewName: "משנה מקואות",
    aliases: ["Mishnah Miḳvaoth"],
    numChapters: 10,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Niddah",
    hebrewName: "משנה נדה",
    aliases: [],
    numChapters: 10,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Makhshirin",
    hebrewName: "משנה מכשירין",
    aliases: [],
    numChapters: 6,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Zavim",
    hebrewName: "משנה זבים",
    aliases: ["Mishnah Zabim"],
    numChapters: 5,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Tevul Yom",
    hebrewName: "משנה טבול יום",
    aliases: [],
    numChapters: 4,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Yadayim",
    hebrewName: "משנה ידים",
    aliases: [],
    numChapters: 4,
  }),
  new MishnaMasechet({
    canonicalName: "Mishnah Oktzin",
    hebrewName: "משנה עוקצים",
    aliases: ["Mishnah ʿUḳtsin"],
    numChapters: 3,
  }),

  new LiturgicalBook({
    // If this is changed to add Mincha/other things, make sure to update sitemap logic
    canonicalName: "SiddurAshkenaz",
    hebrewName: "סידור אשכנז",
    aliases: [],
    sections: SIDDUR_REFS_ASHKENAZ,
    bookType: "Siddur",
    bookNameForRef: "Siddur Ashkenaz, Weekday, Shacharit,",
  }),
  new LiturgicalBook({
    canonicalName: "SiddurSefard",
    hebrewName: "סידור ספרד",
    aliases: [],
    sections: SIDDUR_REFS_SEFARD,
    bookType: "Siddur",
    bookNameForRef: "Siddur Sefard, Weekday, Shacharit,",
  }),
  new SyntheticBook("WeekdayTorah"),
  new LiturgicalBook({
    canonicalName: "BirkatHamazon",
    hebrewName: "ברכת המזון",
    aliases: [],
    sections: BIRKAT_HAMAZON_REFS,
    bookType: "Siddur",
    bookNameForRef: "Siddur Ashkenaz, Berachot, Birkat HaMazon,",
  }),
]);

export function internalLinkableRef(ref: string): QueryResult | undefined {
  for (const title of Object.keys(books.byCanonicalName)) {
    if (ref.startsWith(title)) {
      try {
        return books.parse(ref.split(":")[0]);
      } catch {
        continue;
      }
    }
  }
  return undefined;
}
