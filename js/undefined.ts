export const checkNotUndefined = <T>(value: T | undefined, name?: string): T => {
  if (value === undefined) {
    if (name) {
      throw new Error(`${name} is undefined`);
    }
    throw new Error("undefined");
  }
  return value;
};
