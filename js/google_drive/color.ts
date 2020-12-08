export function rgbColor(red: number, green: number, blue: number): gapi.client.docs.OptionalColor {
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
