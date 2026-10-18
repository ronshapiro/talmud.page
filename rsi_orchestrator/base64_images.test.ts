import {
  extractBase64Images,
  extractBase64ImagesForCritique,
  formatCritiqueImagePlaceholderNote,
  formatGenerationImagePlaceholderNote,
  replaceBase64ImagesWithPlaceholders,
  restoreBase64Images,
  restoreBase64ImagesInEdit,
} from "./base64_images";

const SAMPLE_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhg"
  + "GAWjR9awAAAABJRU5ErkJggg==";
const SAMPLE_JPEG_BASE64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP/////////////////////////////////////"
  + "/////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAA"
  + "AP/aAAgBAQABPxA=";

describe("extractBase64Images", () => {
  test("returns text unchanged and empty images array when no base64 images exist", () => {
    const sourceText = 'זהו טקסט רגיל עם <b>תגיות</b> ללא תמונות:';
    const result = extractBase64Images(sourceText);
    expect(result.textWithPlaceholders).toBe(sourceText);
    expect(result.images).toEqual([]);
  });

  test("extracts a single PNG base64 image and replaces it with IMAGE_PLACEHOLDER_1", () => {
    const dataUri = `data:image/png;base64,${SAMPLE_PNG_BASE64}`;
    const sourceText = `הגה"ה <img src="${dataUri}"> ע"כ`;
    const result = extractBase64Images(sourceText);

    expect(result.textWithPlaceholders).toBe('הגה"ה <img src="IMAGE_PLACEHOLDER_1"> ע"כ');
    expect(result.images).toHaveLength(1);
    expect(result.images[0].placeholder).toBe("IMAGE_PLACEHOLDER_1");
    expect(result.images[0].dataUri).toBe(dataUri);
    expect(result.images[0].mediaType).toBe("image/png");
    expect(result.images[0].extension).toBe("png");
    expect(result.images[0].base64Data).toBe(SAMPLE_PNG_BASE64);
    expect(result.images[0].buffer.equals(Buffer.from(SAMPLE_PNG_BASE64, "base64"))).toBe(true);
  });

  test("extracts multiple distinct images and deduplicates identical images", () => {
    const firstDataUri = `data:image/png;base64,${SAMPLE_PNG_BASE64}`;
    const secondDataUri = `data:image/jpeg;base64,${SAMPLE_JPEG_BASE64}`;
    const sourceText = [
      `תמונה ראשונה <img src="${firstDataUri}">`,
      `תמונה שניה <img src="${secondDataUri}">`,
      `שוב ראשונה <img src="${firstDataUri}">`,
    ].join(" ");

    const result = extractBase64Images(sourceText);
    expect(result.textWithPlaceholders).toBe(
      'תמונה ראשונה <img src="IMAGE_PLACEHOLDER_1"> '
      + 'תמונה שניה <img src="IMAGE_PLACEHOLDER_2"> '
      + 'שוב ראשונה <img src="IMAGE_PLACEHOLDER_1">',
    );
    expect(result.images).toHaveLength(2);
    expect(result.images[0].placeholder).toBe("IMAGE_PLACEHOLDER_1");
    expect(result.images[0].extension).toBe("png");
    expect(result.images[1].placeholder).toBe("IMAGE_PLACEHOLDER_2");
    expect(result.images[1].extension).toBe("jpg");
    expect(result.images[1].mediaType).toBe("image/jpeg");
  });
});

describe("restoreBase64Images and restoreBase64ImagesInEdit", () => {
  test("restores placeholders back to original data URIs without prefix collisions", () => {
    const sourceParts: string[] = [];
    for (let i = 1; i <= 12; i++) {
      const encodedPayload = Buffer.from(`image-content-${i}`).toString("base64");
      sourceParts.push(`<img src="data:image/png;base64,${encodedPayload}">`);
    }
    const sourceText = sourceParts.join(" ");
    const {textWithPlaceholders, images} = extractBase64Images(sourceText);

    expect(textWithPlaceholders).toContain("IMAGE_PLACEHOLDER_1");
    expect(textWithPlaceholders).toContain("IMAGE_PLACEHOLDER_12");
    expect(restoreBase64Images(textWithPlaceholders, images)).toBe(sourceText);
  });

  test("restores placeholders even if model includes file extension or @path prefix", () => {
    const dataUri = `data:image/png;base64,${SAMPLE_PNG_BASE64}`;
    const {images} = extractBase64Images(`<img src="${dataUri}">`);

    expect(restoreBase64Images('<img src="IMAGE_PLACEHOLDER_1.png">', images))
      .toBe(`<img src="${dataUri}">`);
    expect(restoreBase64Images('<img src="@/tmp/agent-images-123/IMAGE_PLACEHOLDER_1.png">', images))
      .toBe(`<img src="${dataUri}">`);
  });

  test("restores placeholders in both hebrew and english fields of an Edit", () => {
    const dataUri = `data:image/png;base64,${SAMPLE_PNG_BASE64}`;
    const {images} = extractBase64Images(`הגה"ה <img src="${dataUri}">`);
    const modelEdit = {
      hebrew: '<b>הגה"ה</b> - <img src="IMAGE_PLACEHOLDER_1">:',
      english: '<b>Gloss:</b> <img src="IMAGE_PLACEHOLDER_1">.',
    };

    const restoredEdit = restoreBase64ImagesInEdit(modelEdit, images);
    expect(restoredEdit).toEqual({
      hebrew: `<b>הגה"ה</b> - <img src="${dataUri}">:`,
      english: `<b>Gloss:</b> <img src="${dataUri}">.`,
    });
  });
});

describe("extractBase64ImagesForCritique", () => {
  test("shares placeholder numbering across original Hebrew, proposed Hebrew, and proposed English", () => {
    const dataUri = `data:image/png;base64,${SAMPLE_PNG_BASE64}`;
    const hebrewSource = `הגה"ה <img src="${dataUri}"> ע"כ`;
    const proposedEdit = {
      hebrew: `<strong class="dibur-hamatchil">הגה"ה</strong> - <img src="${dataUri}"> ע"כ:`,
      english: `<strong class="dibur-hamatchil">Gloss:</strong> <img src="${dataUri}">.`,
    };

    const extracted = extractBase64ImagesForCritique(hebrewSource, proposedEdit);
    expect(extracted.originalHebrewWithPlaceholders).toBe('הגה"ה <img src="IMAGE_PLACEHOLDER_1"> ע"כ');
    expect(extracted.proposedHebrewWithPlaceholders).toBe(
      '<strong class="dibur-hamatchil">הגה"ה</strong> - <img src="IMAGE_PLACEHOLDER_1"> ע"כ:',
    );
    expect(extracted.proposedEnglishWithPlaceholders).toBe(
      '<strong class="dibur-hamatchil">Gloss:</strong> <img src="IMAGE_PLACEHOLDER_1">.',
    );
    expect(extracted.images).toHaveLength(1);
  });
});

describe("replaceBase64ImagesWithPlaceholders and prompt notes", () => {
  test("replaceBase64ImagesWithPlaceholders strips raw base64 data", () => {
    const dataUri = `data:image/png;base64,${SAMPLE_PNG_BASE64}`;
    const replaced = replaceBase64ImagesWithPlaceholders(`לפני <img src="${dataUri}"> אחרי`);
    expect(replaced).toBe('לפני <img src="IMAGE_PLACEHOLDER_1"> אחרי');
  });

  test("formats generation and critique notes only when images are present", () => {
    expect(formatGenerationImagePlaceholderNote([])).toBe("");
    expect(formatCritiqueImagePlaceholderNote([])).toBe("");

    const dataUri = `data:image/png;base64,${SAMPLE_PNG_BASE64}`;
    const {images} = extractBase64Images(`<img src="${dataUri}">`);
    expect(formatGenerationImagePlaceholderNote(images)).toContain("IMAGE_PLACEHOLDER_1");
    expect(formatCritiqueImagePlaceholderNote(images)).toContain("IMAGE_PLACEHOLDER_1");
  });
});
