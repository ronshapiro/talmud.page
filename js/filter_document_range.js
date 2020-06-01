const inRange = (start, end) => {
  return x => {
    if (x.startIndex === start) {
      return true;
    } else if (x.startIndex < start) {
      return x.endIndex > start;
    }
    return x.startIndex < end;
  };
}

const filterDocumentRange = (start, end, inputs) => {
  return inputs
    .filter(inRange(start, end))
    .map(x => {
      const text = x.textRun.content;
      return text.substring(
        start - x.startIndex,
        end > x.endIndex ? text.length : text.length - (x.endIndex - end));
    })
    .filter((x, index) => !(index === 0 && x === "\n"))
    .map(x => x.endsWith("\n") ? x.substring(0, x.length - 1) : x);
}

module.exports = {
  filterDocumentRange: filterDocumentRange,
  inRange: inRange,
};
