import {TEST_DATA_ROOT} from "../request_makers";

class TestPage {
  constructor(readonly title: string, readonly page: string) {}

  outputFilePath(): string {
    return `${TEST_DATA_ROOT}/${this.title.replace(/ /g, "_")}.${this.page}.expected-output.json`;
  }
}

export const testPages = [
  new TestPage("Berakhot", "2a"),
  new TestPage("Berakhot", "34b"),
  new TestPage("Shabbat", "100a"),
  new TestPage("Eruvin", "11a"), // Has images
  new TestPage("Eruvin", "6b"), // Has images, including a comment with multiple images
  new TestPage("Eruvin", "105a"), // Ends with Hadran that has vocalization
  new TestPage("Gittin", "85b"), // Has a link to Even HaEzer, Seder HaGet
  new TestPage("Kiddushin", "38a"), // Has a comment cycle
  new TestPage("Moed Katan", "21a"), // Has a link to Even HaEzer, Seder Halitzah
  new TestPage("Nazir", "33b"), // Has no gemara, just Tosafot
  new TestPage("Shabbat", "74b"), // Has weird API response with nested comment text from Rosh
  new TestPage("Tamid", "25b"), // No Rashi

  new TestPage("Shekalim", "2a"),
  new TestPage("Shekalim", "3a"), // Has spanningRefs
  new TestPage("Shekalim", "7b"), // Has strange text shape in the API response

  new TestPage("Genesis", "43"),
  new TestPage("Exodus", "20"), // 10 commandments, covers all mam-spi-pe and mam-spi-samekhs
  new TestPage("Deuteronomy", "34"),
  new TestPage("I Samuel", "18"),
  new TestPage("Obadiah", "1"),

  new TestPage("SiddurAshkenaz", "Hodu"),
  new TestPage("SiddurAshkenaz", "Ashrei"),
  new TestPage("SiddurAshkenaz", "Amidah_-_Opening"),
  new TestPage("SiddurSefard", "Hodu"),
  new TestPage("SiddurSefard", "Amidah_-_Opening"),
  new TestPage("BirkatHamazon", "Shir_Hama'alot"),
  new TestPage("BirkatHamazon", "Zimun"),
  new TestPage("BirkatHamazon", "Birkat_Hamazon"),
];
