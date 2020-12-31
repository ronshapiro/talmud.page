import {ImageNumberingFormatter} from "../image_numbering";

test("single image", () => {
  expect(ImageNumberingFormatter.process([
    `before`,
    `<img src="data:image/png;base64,DATA">`,
    `after`,
  ].join("")))
    .toBe([
      `before`,
      `<span class="image-ref-container">`,
      `<span class="image-ref-text">(*):</span>`,
      `<span class="image-ref">`,
      `<img src="data:image/png;base64,DATA">`,
      `</span>`,
      `</span>`,
      `<span class="image-pointer">(*)</span>`,
      `after`,
    ].join(""));
});

test("multiple images", () => {
  expect(ImageNumberingFormatter.process([
    `before`,
    `<img src="data:image/png;base64,DATA1">`,
    `middle12`,
    `<img src="data:image/png;base64,DATA2">`,
    `middle23`,
    `<img src="data:image/png;base64,DATA3">`,
    `after`,
  ].join("")))
    .toBe([
      `before`,
      `<span class="image-ref-container">`,
      `<span class="image-ref-text">(1):</span>`,
      `<span class="image-ref">`,
      `<img src="data:image/png;base64,DATA1">`,
      `</span>`,
      `</span>`,
      `<span class="image-pointer">(1)</span>`,
      `middle12`,
      `<span class="image-ref-container">`,
      `<span class="image-ref-text">(2):</span>`,
      `<span class="image-ref">`,
      `<img src="data:image/png;base64,DATA2">`,
      `</span>`,
      `</span>`,
      `<span class="image-pointer">(2)</span>`,
      `middle23`,
      `<span class="image-ref-container">`,
      `<span class="image-ref-text">(3):</span>`,
      `<span class="image-ref">`,
      `<img src="data:image/png;base64,DATA3">`,
      `</span>`,
      `</span>`,
      `<span class="image-pointer">(3)</span>`,
      `after`,
    ].join(""));
});
