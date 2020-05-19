const computePreviousAmud = function(current) {
  const number = parseInt(current);
  return current.endsWith("b") ? number + "a" : (number - 1) + "b";
}

const computeNextAmud = function(current) {
  const number = parseInt(current);
  return current.endsWith("a") ? number + "b" : (number + 1) + "a";
}

const SPACE_REGEX = /(%20|_)/g;

const amudMetadata = function(pathname) {
  const pathParts = pathname.split("/");
  return {
    masechet: pathParts[1].replace(SPACE_REGEX, " "),
    amudStart: pathParts[2],
    amudEnd: pathParts[4] || pathParts[2],
    range: function() {
      let current = this.amudStart;
      const results = [current];
      while (current !== this.amudEnd) {
        current = computeNextAmud(current);
        results.push(current);
      }
      return results;
    }
  }
}

module.exports = {
  computeNextAmud: computeNextAmud,
  computePreviousAmud: computePreviousAmud,
  amudMetadata: () => amudMetadata(location.pathname),
  amudMetadataForTesting: amudMetadata,
};