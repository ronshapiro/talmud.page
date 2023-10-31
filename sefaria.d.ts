declare namespace sefaria {
  export interface ErrorResponse {
    error?: string;
  }

  // When this becomes a more jagged-type, remove the ts-ignores in sefariaTextType.test.ts
  export type TextType = string | string[];

  export interface TextLink extends ErrorResponse {
    collectiveTitle?: {en: string, he: string};
    category?: string;
    type?: string;
    sourceRef: string;
    sourceHeRef: string;
    ref: string;
    anchorRef: string;
    anchorRefExpanded: string[];
    versionTitle: string;
    originalRefsBeforeRewriting?: string[];
    expandedRefsAfterRewriting?: string[];
  }

  export interface TextLinkWithText extends TextLink {
    he: TextType;
    text: TextType;
  }

  export interface TextResponse {
    he: TextType;
    text: TextType;
    ref: string;
    title?: string;
    indexTitle?: string;
    isSpanning?: boolean;
    spanningRefs?: string[];
    refsPerSubText?: string[];
  }

  interface BulkTextValue {
    he: TextType;
    en: TextType;
    ref: string;
  }

  export type BulkTextResponse = Record<string, BulkTextValue>;
}
