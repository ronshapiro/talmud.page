import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {Edit} from "../precomputed/ai_edits";

export interface DecodedImage {
  placeholder: string;
  dataUri: string;
  mediaType: string;
  extension: string;
  base64Data: string;
  buffer: Buffer;
  filePath: string;
}

export interface ExtractedBase64Images {
  textWithPlaceholders: string;
  images: DecodedImage[];
}

export interface ExtractBase64ImagesOptions {
  existingImages?: DecodedImage[];
  ref?: string;
}

const DATA_IMAGE_URI_PATTERN = /data:image\/([\d+.A-Za-z-]+);base64,([\d\n\r+/=A-Za-z]+)/g;
const PLACEHOLDER_REFERENCE_PATTERN = new RegExp(
  "(?:@?[^\\s\"'<>]*\\/)?(?:[\\w-]+_)?(IMAGE_PLACEHOLDER_\\d+)(?:\\.[\\dA-Za-z]+)?",
  "g",
);

const KNOWN_IMAGE_SUBTYPE_EXTENSIONS: Record<string, string> = {
  png: "png",
  jpeg: "jpg",
  jpg: "jpg",
  gif: "gif",
  webp: "webp",
  "svg+xml": "svg",
};

let processBase64ImagesDirectory: string | undefined;

/**
 * Returns a shared temporary directory for decoded base64 images in the current process.
 * Sharing the directory across turns ensures that in long-thread conversations
 * (`claude-long-thread`, `agy-long-thread`), image files from earlier turns remain accessible and
 * covered by `--add-dir` for the lifetime of the session, while naming files with their sanitized
 * `ref` prevents collisions across different comments on a page.
 */
export function getOrCreateBase64ImagesDirectory(): string {
  if (processBase64ImagesDirectory && fs.existsSync(processBase64ImagesDirectory)) {
    return processBase64ImagesDirectory;
  }
  processBase64ImagesDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "rsi-base64-images-"));
  return processBase64ImagesDirectory;
}

/**
 * Cleans up the shared temporary directory for decoded base64 images if one was created.
 */
export function cleanupBase64ImagesDirectory(): void {
  if (processBase64ImagesDirectory) {
    try {
      fs.rmSync(processBase64ImagesDirectory, {recursive: true, force: true});
    } catch {
      // Best-effort cleanup
    }
    processBase64ImagesDirectory = undefined;
  }
}

process.on("exit", () => {
  cleanupBase64ImagesDirectory();
});

export function extensionFromSubtype(subtype: string): string {
  const normalizedSubtype = subtype.toLowerCase();
  const extension = KNOWN_IMAGE_SUBTYPE_EXTENSIONS[normalizedSubtype];
  if (!extension) {
    const knownList = Object.keys(KNOWN_IMAGE_SUBTYPE_EXTENSIONS).join(", ");
    const message = `Unsupported base64 image subtype "${subtype}". Known subtypes: ${knownList}`;
    console.error(message); // eslint-disable-line no-console
    throw new Error(message);
  }
  return extension;
}

export function sanitizeRefForFilename(ref: string): string {
  return ref.trim().replace(/[^\dA-Za-z]+/g, "_").replace(/^_+|_+$/g, "");
}

/**
 * Finds all `data:image/<subtype>;base64,<data>` URIs in `text`, decodes each unique image into a
 * `DecodedImage` written to the shared temporary image directory, and replaces each data URI with a
 * compact placeholder (`IMAGE_PLACEHOLDER_1`, `IMAGE_PLACEHOLDER_2`, etc.).
 *
 * Passing `existingImages` allows multiple strings in the same prompt (such as original Hebrew,
 * proposed Hebrew, and proposed English in a critique prompt) to share a consistent placeholder
 * numbering where identical data URIs map to the same placeholder.
 */
export function extractBase64Images(
  text: string,
  options: ExtractBase64ImagesOptions | DecodedImage[] = {},
): ExtractedBase64Images {
  const normalizedOptions: ExtractBase64ImagesOptions = Array.isArray(options)
    ? {existingImages: options}
    : options;
  const images: DecodedImage[] = [...(normalizedOptions.existingImages ?? [])];
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
        if (!fs.existsSync(existingImage.filePath)) {
          fs.mkdirSync(path.dirname(existingImage.filePath), {recursive: true});
          fs.writeFileSync(existingImage.filePath, existingImage.buffer);
        }
        return existingImage.placeholder;
      }
      const placeholder = `IMAGE_PLACEHOLDER_${images.length + 1}`;
      const extension = extensionFromSubtype(subtype);
      const buffer = Buffer.from(cleanedBase64, "base64");
      const directoryPath = getOrCreateBase64ImagesDirectory();
      const sanitizedRef = normalizedOptions.ref
        ? sanitizeRefForFilename(normalizedOptions.ref)
        : "";
      const fileName = sanitizedRef
        ? `${sanitizedRef}_${placeholder}.${extension}`
        : `${placeholder}.${extension}`;
      const filePath = path.join(directoryPath, fileName);
      fs.writeFileSync(filePath, buffer);
      images.push({
        placeholder,
        dataUri: fullMatch,
        mediaType,
        extension,
        base64Data: cleanedBase64,
        buffer,
        filePath,
      });
      return placeholder;
    },
  );
  return {textWithPlaceholders, images};
}

/**
 * Appends `@<filePath>` references for each decoded image at the end of `prompt` if not already
 * present. In Claude CLI (`claude -p`), `@<filePath>` is automatically extracted and attached as a
 * native multimodal image content block on the user message when the image directory is added via
 * `--add-dir`. In Antigravity (`agy -p`), the file path allows the agent to view the image file.
 */
export function appendImageAttachmentsToPrompt(
  prompt: string,
  images: DecodedImage[],
): string {
  if (images.length === 0) return prompt;
  const unattachedImages = images.filter(image => !prompt.includes(`@${image.filePath}`));
  if (unattachedImages.length === 0) return prompt;
  const attachmentLines = unattachedImages.map(
    image => `- ${image.placeholder}: @${image.filePath}`,
  );
  return `${prompt}\n\nAttached image(s):\n${attachmentLines.join("\n")}`;
}

/**
 * Replaces any `data:image/...;base64,...` URIs in `text` with `IMAGE_PLACEHOLDER_1`, etc.,
 * writes the decoded images to temporary files, and appends their temporary file locations.
 */
export function replaceBase64ImagesWithTempFileLocations(
  text: string,
  options?: ExtractBase64ImagesOptions,
): string {
  const {textWithPlaceholders, images} = extractBase64Images(text, options);
  return appendImageAttachmentsToPrompt(textWithPlaceholders, images);
}

/**
 * Restores `IMAGE_PLACEHOLDER_N` tokens in `text` back to their original
 * `data:image/...;base64,...` strings. Also handles cases where a model accidentally includes the
 * temporary file path, ref prefix, or extension (e.g. `IMAGE_PLACEHOLDER_1.png`).
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
  ref?: string,
): ExtractedCritiqueImages {
  const sourceResult = extractBase64Images(hebrewSource, {ref});
  const hebrewResult = edit.hebrew !== undefined
    ? extractBase64Images(edit.hebrew, {ref, existingImages: sourceResult.images})
    : {textWithPlaceholders: "(unchanged)", images: sourceResult.images};
  const englishResult = edit.english !== undefined
    ? extractBase64Images(edit.english, {ref, existingImages: hebrewResult.images})
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
