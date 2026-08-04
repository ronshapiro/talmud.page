/**
 * Tests for `transformAmudData`, the pure form of `Renderer._applyClientSideDataTransformations`.
 * `Renderer_transformations.test.ts` already covers the transformation rules themselves (through
 * the mutating wrapper, which is unchanged); these tests cover the properties the pure form adds.
 */
import {transformAmudData} from "../Renderer";
import {commentaries, page, resetFixtureCounter, segment} from "./testing/fixtures";
import {clearPageEnvironment, installPageEnvironment} from "./testing/page_environment";

const OPTIONS = {preferredVersion: undefined, translationOption: "both", isTalmud: true};

beforeEach(() => {
  installPageEnvironment();
  resetFixtureCounter();
});
afterEach(clearPageEnvironment);

test("does not mutate its input", () => {
  const input = page({sections: [segment({uuid: undefined as any})]});
  const inputUuid = input.sections[0].uuid;

  const result = transformAmudData(input, OPTIONS);

  expect(input.sections[0].uuid).toBe(inputUuid);
  expect(result.sections[0].uuid).toBeTruthy();
  expect(result.sections[0].uuid).not.toBe(inputUuid);
});

test("preserves a Set-valued highlightColors", () => {
  const input = page({
    sections: [segment({highlightColors: new Set(["red", "blue"])})],
  });

  const result = transformAmudData(input, OPTIONS);

  expect(result.sections[0].highlightColors).toEqual(new Set(["red", "blue"]));
});

test("is idempotent", () => {
  const input = page({
    sections: [segment({
      ref: "Berakhot 2a:1",
      en: "gemara english",
      commentary: commentaries({
        Steinsaltz: [{ref: "Steinsaltz on Berakhot 2a:1", he: "שטיינזלץ", en: "steinsaltz en"}],
      }),
    })],
  });

  const once = transformAmudData(input, OPTIONS);
  const twice = transformAmudData(once, OPTIONS);

  expect(twice).toEqual(once);
});
