export const checkNotUndefined = <T>(value: T | undefined, name: string): T => {
  if (value === undefined) {
    throw new Error(`${name} is undefined`);
  }
  return value;
};
