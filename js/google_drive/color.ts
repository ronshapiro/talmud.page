import {Color} from "./types";

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
