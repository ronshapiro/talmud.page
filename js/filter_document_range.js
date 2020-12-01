const $ = require("jquery");

const inRange = (start, end) => (x) => {
  if (x.startIndex === start) {
    return true;
  } else if (x.startIndex < start) {
    return x.endIndex > start;
  }
  return x.startIndex < end;
};

const updateText = (element, updated) => {
  const original = element.textRun.content;
  if (updated === original) {
    return element;
  }
  return {
    ...element,
    textRun: {
      ...element.textRun,
      content: updated,
    },
  };
};

const trimContents = (elements) => (
  elements.map(element => updateText(element, element.textRun.content.trim()))
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

const htmlEscape = elements => (
  elements.map(x => updateText(x, $("<p>").text(x.textRun.content).html()))
);

const trimTextsByFilterRange = (start, end) => {
  return elements => (
    elements.map(x => {
      const text = x.textRun.content;
      return updateText(
        x,
        text.substring(
          start - x.startIndex,
          end > x.endIndex ? text.length : text.length - (x.endIndex - end)));
    })
  );
};

const applyTextStyle = elements => (
  elements.map(element => {
    let text = element.textRun.content;
    const style = element.textRun.textStyle || {};
    const classes = (
      ["bold", "italic", "underline", "strikethrough"]
        .filter(x => style[x])
        .map(x => `personal-comment-${x}`)
        .join(" ")
    );
    if (classes.length > 0) {
      text = `<span class="${classes}">${text}</span>`;
    }
    if (style.link && style.link.url) {
      text = `<a href="${style.link.url}">${text}</a>`;
    }
    return updateText(element, text);
  })
);

// TODO: this does a lot more than filtering now - rename it to something like getDocumentText
const filterDocumentRange = (start, end, inputs) => {
  const transformations = [
    elements => elements.filter(inRange(start, end)),
    trimTextsByFilterRange(start, end),
    htmlEscape,
    applyTextStyle,
    joinAdjacentElements,
    trimContents,
  ];

  let transformed = inputs;
  for (const transformation of transformations) {
    transformed = transformation(transformed);
  }
  return transformed.map(x => x.textRun.content).map(x => x.replace(/\n/g, "<br>"));
};

module.exports = {
  filterDocumentRange,
  inRange,
  joinAdjacentElements,
};
