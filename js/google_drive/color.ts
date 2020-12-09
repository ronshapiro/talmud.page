// @ts-ignore
import {Color} from "./types.ts";

export function rgbColor(red: number, green: number, blue: number): Color {
  return {
    color: {
      rgbColor: {
        red: red / 256,
        green: green / 256,
        blue: blue / 256,
      },
    },
  };
}
