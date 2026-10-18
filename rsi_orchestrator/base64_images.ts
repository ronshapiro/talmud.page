import {Edit} from "../precomputed/ai_edits";

export interface DecodedImage {
  placeholder: string;
  dataUri: string;
  mediaType: string;
  extension: string;
  base64Data: string;
  buffer: Buffer;
}

export interface ExtractedBase64Images {
  textWithPlaceholders: string;
  images: DecodedImage[];
}

const DATA_IMAGE_URI_PATTERN = /data:image\/([\d+.A-Za-z-]+);base64,([\d\n\r+/=A-Za-z]+)/g;
const PLACEHOLDER_REFERENCE_PATTERN = new RegExp(
  "(?:@?[^\\s\"'<>]*\\/)?(IMAGE_PLACEHOLDER_\\d+)(?:\\.[\\dA-Za-z]+)?",
  "g",
);

function extensionFromSubtype(subtype: string): string {
  const normalizedSubtype = subtype.toLowerCase();
  if (normalizedSubtype === "jpeg") return "jpg";
  if (normalizedSubtype === "svg+xml") return "svg";
  return normalizedSubtype.replace(/[^\da-z]/g, "") || "png";
}

/**
 * Finds all `data:image/<subtype>;base64,<data>` URIs in `text`, decodes each unique image into a
 * `DecodedImage`, and replaces each data URI with a compact placeholder (`IMAGE_PLACEHOLDER_1`,
 * `IMAGE_PLACEHOLDER_2`, etc.).
 *
 * Passing `existingImages` allows multiple strings in the same prompt (such as original Hebrew,
 * proposed Hebrew, and proposed English in a critique prompt) to share a consistent placeholder
 * numbering where identical data URIs map to the same placeholder.
 */
export function extractBase64Images(
  text: string,
  existingImages: DecodedImage[] = [],
): ExtractedBase64Images {
  const images: DecodedImage[] = [...existingImages];
  const textWithPlaceholders = text.replace(
    DATA_IMAGE_URI_PATTERN,
    (fullMatch: string, subtype: string, rawBase64: string) => {
      const cleanedBase64 = rawBase64.replace(/\s+/g, "");
      const mediaType = `image/${subtype.toLowerCase()}`;
      const existingImage = images.find(
        image => image.dataUri === fullMatch
          || (image.mediaType === mediaType && image.base64Data === cleanedBase64),
      );
      if (existingImage) {
        return existingImage.placeholder;
      }
      const placeholder = `IMAGE_PLACEHOLDER_${images.length + 1}`;
      const extension = extensionFromSubtype(subtype);
      const buffer = Buffer.from(cleanedBase64, "base64");
      images.push({
        placeholder,
        dataUri: fullMatch,
        mediaType,
        extension,
        base64Data: cleanedBase64,
        buffer,
      });
      return placeholder;
    },
  );
  return {textWithPlaceholders, images};
}

/**
 * Replaces any `data:image/...;base64,...` URIs in `text` with `IMAGE_PLACEHOLDER_1`, etc.,
 * discarding the decoded buffers (useful when indexing context or worked examples).
 */
export function replaceBase64ImagesWithPlaceholders(text: string): string {
  return extractBase64Images(text).textWithPlaceholders;
}

/**
 * Restores `IMAGE_PLACEHOLDER_N` tokens in `text` back to their original
 * `data:image/...;base64,...` strings. Also handles cases where a model accidentally includes the
 * temporary file path or extension (e.g. `IMAGE_PLACEHOLDER_1.png`).
 */
export function restoreBase64Images(text: string, images: DecodedImage[]): string {
  if (images.length === 0) return text;
  const placeholderToDataUri = new Map<string, string>();
  for (const image of images) {
    placeholderToDataUri.set(image.placeholder, image.dataUri);
  }
  return text.replace(
    PLACEHOLDER_REFERENCE_PATTERN,
    (fullMatch: string, placeholder: string) => placeholderToDataUri.get(placeholder) ?? fullMatch,
  );
}

/**
 * Restores any `IMAGE_PLACEHOLDER_N` tokens in `edit.hebrew` and `edit.english` back to their
 * original `data:image/...;base64,...` strings.
 */
export function restoreBase64ImagesInEdit(edit: Edit, images: DecodedImage[]): Edit {
  if (images.length === 0) return edit;
  const restoredEdit: Edit = {...edit};
  if (restoredEdit.hebrew !== undefined) {
    restoredEdit.hebrew = restoreBase64Images(restoredEdit.hebrew, images);
  }
  if (restoredEdit.english !== undefined) {
    restoredEdit.english = restoreBase64Images(restoredEdit.english, images);
  }
  return restoredEdit;
}

export interface ExtractedCritiqueImages {
  originalHebrewWithPlaceholders: string;
  proposedHebrewWithPlaceholders: string;
  proposedEnglishWithPlaceholders: string;
  images: DecodedImage[];
}

/**
 * Extracts base64 images across the original Hebrew source and the proposed edit's Hebrew and
 * English fields, sharing a single placeholder list so identical images receive the same
 * `IMAGE_PLACEHOLDER_N` identifier across all three strings.
 */
export function extractBase64ImagesForCritique(
  hebrewSource: string,
  edit: Edit,
): ExtractedCritiqueImages {
  const sourceResult = extractBase64Images(hebrewSource);
  const hebrewResult = edit.hebrew !== undefined
    ? extractBase64Images(edit.hebrew, sourceResult.images)
    : {textWithPlaceholders: "(unchanged)", images: sourceResult.images};
  const englishResult = edit.english !== undefined
    ? extractBase64Images(edit.english, hebrewResult.images)
    : {textWithPlaceholders: "(none)", images: hebrewResult.images};
  return {
    originalHebrewWithPlaceholders: sourceResult.textWithPlaceholders,
    proposedHebrewWithPlaceholders: hebrewResult.textWithPlaceholders,
    proposedEnglishWithPlaceholders: englishResult.textWithPlaceholders,
    images: englishResult.images,
  };
}

export function formatGenerationImagePlaceholderNote(images: DecodedImage[]): string {
  if (images.length === 0) return "";
  const placeholderList = images.map(image => image.placeholder).join(", ");
  return "Note: Base64-encoded images in the source text have been decoded and attached as real "
    + `images with placeholders (${placeholderList}). Preserve each `
    + '<img src="IMAGE_PLACEHOLDER_..."> tag verbatim in your output (and in the English '
    + "translation where appropriate) — do not attempt to write base64 data.";
}

export function formatCritiqueImagePlaceholderNote(images: DecodedImage[]): string {
  if (images.length === 0) return "";
  const placeholderList = images.map(image => image.placeholder).join(", ");
  return "Note: Base64-encoded images have been decoded and attached as real images using "
    + `placeholders (${placeholderList}). Treat matching placeholders as preserving the original `
    + "image.";
}
