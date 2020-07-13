// TODO: tests, and rename _concat references
const concat = (...args) => {
  const result = [];
  for (const arg of args) {
    if (arg) result.push(...arg);
  }
  return result;
};

export default concat;
