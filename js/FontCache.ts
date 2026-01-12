/* eslint-disable unicorn/prefer-add-event-listener */
import {AbstractIndexedDb, result} from "./AbstractIndexedDb";
import {timeoutPromise} from "./promises";

interface Descriptors {
  weight?: string;
  style?: string;
}

interface Font {
  family: string;
  url: string;
  descriptors?: Descriptors;
}

// https://opensiddur.org/help/fonts/
const FONTS: Font[] = [
  {
    family: "Taamey David",
    url: "font/TaameyDavidCLM-Medium.ttf",
  },
  {
    family: "Taamey David",
    url: "font/TaameyDavidCLM-Bold.ttf",
    descriptors: {
      weight: "700",
    },
  },
  {
    family: "Taamey David",
    url: "font/TaameyDavidCLM-MediumOblique.ttf",
    descriptors: {
      style: "italic",
    },
  },
  {
    family: "Taamey David",
    url: "font/TaameyDavidCLM-BoldOblique.ttf",
    descriptors: {
      style: "italic",
      weight: "700",
    },
  },
  {
    family: 'Fira Light',
    url: "font/FiraGO-Light.ttf",
  },
  {
    family: "Material Icons",
    url: "font/material-icons.woff2",
  },
];

function createAndLoadFont(data: ArrayBuffer, font: Font) {
  const fontFace = new FontFace(font.family, data, font.descriptors);
  fontFace.load().then(() => {
    document.fonts.add(fontFace);
  }).catch((error) => {
    console.error('Failed to load font from IndexedDB:', error);
  });
}

interface FontRow {
  id: string;
  fontData: ArrayBuffer;
}

/**
 * Loads and performs font caching within the application to ensure that fonts are always available
 * even in offline mode. Otherwise, the browser cache may still purge the fonts leading to a poor
 * experience.
 */
export class FontCache extends AbstractIndexedDb {
  private whenDbReady: Promise<unknown>;

  constructor() {
    super();
    this.whenDbReady = this.open();
  }

  loadAll(): void {
    for (const font of FONTS) {
      this.load(font);
    }
  }

  load(font: Font): void {
    this.whenDbReady.then(() => {
      const cacheRequest = this.newTransaction("readonly").get(font.url);
      cacheRequest.onsuccess = event => {
        const resultValue = result<FontRow>(event);
        if (resultValue) {
          createAndLoadFont(resultValue.fontData, font);
        } else {
          this.ajaxRequest(font.url).then((loadedFontData) => {
            createAndLoadFont(loadedFontData, font);
            this.newTransaction("readwrite").put({id: font.url, fontData: loadedFontData});
          });
        }
      };
    });
  }

  private async ajaxRequest(endpoint: string, backoff = 200): Promise<ArrayBuffer> {
    try {
      const response = await fetch(`${window.location.origin}/${endpoint}`);
      return await response.arrayBuffer();
    } catch {
      await timeoutPromise(backoff);
      return this.ajaxRequest(endpoint, backoff * 1.5);
    }
  }

  protected databaseName(): string {
    return "FontCache";
  }

  protected objectStoreName(): string {
    return "font_cache";
  }
}
