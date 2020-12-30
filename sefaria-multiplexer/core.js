/* eslint-disable @typescript-eslint/no-var-requires */
const express = require("express");
const fetch = require("make-fetch-happen");

const app = express();

function sefariaJson(endpoint) {
  return fetch(`https://sefaria.org/api${endpoint}`, {
    retry: {
      retries: 4,
      minTimeout: 200,
    },
  })
    .then(x => x.json())
    .then(json => {
      if (json.error) {
        console.error(json);
        return Promise.reject(json);
      }
      return Promise.resolve(json);
    });
}

function textRequest(ref) {
  return sefariaJson(`/texts/${ref}?wrapLinks=0&commentary=0&context=0`);
}

function retainValues(json, ...keys) {
  const result = {};
  for (const key of keys) {
    result[key] = json[key];
  }
  return result;
}

function extractSourceTextData(sefariaResult) {
  const retained = retainValues(sefariaResult, "he", "text", "ref", "title", "indexTitle");
  if (!retained.title) {
    retained.title = sefariaResult.sectionRef;
  }
  retained.commentary = [];
  return retained;
}

function extractCommentaryData(link, sefariaResult) {
  const retained = retainValues(sefariaResult, "he", "text", "ref");
  Object.assign(
    retained,
    retainValues(
      link, "collectiveTitle", "sourceRef", "sourceHeRef", "anchorRefExpanded", "category", "type"),
  );
  return retained;
}

function isDesiredCommentary(commentary) {
  return [
    "Rashi on ",
    "Ramban on ",
    "Rashbam on ",
  ].some(x => commentary.index_title.indexOf(x) === 0)
    && commentary.category !== "Quoting Commentary";
}

app.get("/:ref", async (req, res) => {
  const {ref} = req.params;
  let basicRequests;
  try {
    basicRequests = await Promise.all([
      textRequest(ref).then(extractSourceTextData),
      sefariaJson(`/links/${ref}?with_text=0`).then(x => x.filter(isDesiredCommentary)),
    ]);
  } catch (e) {
    res.send(e);
    return;
  }
  const [textResult, linksResult] = basicRequests;

  // don't worry about checking the results - this is best effort
  await Promise.allSettled(linksResult.map(link => {
    return textRequest(link.ref)
      .then(linkResult => {
        textResult.commentary.push(extractCommentaryData(link, linkResult));
      });
  }));

  res.send(textResult);
});

const port = process.env.PORT || 3000;
function listen() {
  // eslint-disable-next-line no-console
  app.listen(port, () => console.log(`Starting server on ${port}`));
}

module.exports = {listen};
