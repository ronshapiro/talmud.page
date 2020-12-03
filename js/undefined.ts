export const checkNotUndefined = <T>(value: T, name: string): T => {
  if (value === undefined) {
    throw new Error(`${name} is undefined`);
  }
  return value;
};
