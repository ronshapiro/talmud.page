const inRange = (start, end) => (x) => {
  if (x.startIndex === start) {
    return true;
  } else if (x.startIndex < start) {
    return x.endIndex > start;
  }
  return x.startIndex < end;
};

const trimContents = (elements) => (
  elements.map(element => {
    const original = element.textRun.content;
    const trimmed = original.trim();
    if (trimmed === original) {
      return element;
    }
    return {
      ...element,
      textRun: {
        ...element.textRun,
        content: trimmed,
      },
    };
  })
);

// TODO: add simple styles. But doing so would mangle indices, so perhaps collect styles and apply
// them at the end?
const joinAdjacentElements = (elements) => {
  if (elements.length <= 1) {
    return elements;
  }
  const joinedElements = elements.slice(0, 1);
  for (const current of elements.slice(1)) {
    const previous = joinedElements.slice(-1)[0];
    if (previous.endIndex === current.startIndex) {
      const joined = {
        startIndex: previous.startIndex,
        endIndex: current.endIndex,
        textRun: {
          content: previous.textRun.content + current.textRun.content,
        },
      };
      joinedElements.pop();
      joinedElements.push(joined);
    } else {
      joinedElements.push(current);
    }
  }

  return joinedElements;
};

// TODO: this does a lot more than filtering now - rename it to something like getDocumentText
const filterDocumentRange = (start, end, inputs) => {
  const contents = (
    trimContents(joinAdjacentElements(inputs.filter(inRange(start, end))))
  );
  return contents
    .map(x => {
      const text = x.textRun.content;
      return text.substring(
        start - x.startIndex,
        end > x.endIndex ? text.length : text.length - (x.endIndex - end));
    })
    .map(x => x.replace(/\n/g, "<br>"));
};

module.exports = {
  filterDocumentRange,
  inRange,
  joinAdjacentElements,
};
