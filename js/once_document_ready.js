const create = () => {
  const result = {
    execute: function(fn) {
      if (this.ready) {
        fn();
        return;
      }
      this.queue.push(fn);
    },
    declareReady: function() {
      if (this.ready) {
        throw "Already ready!";
      }
      this.ready = true;
      this.queue.forEach(fn => fn());
      this.queue = [];
    },
    reset: function() {
      this.ready = false;
      this.queue = [];
    },
  };
  result.reset();
  return result;
};

// TODO: improve the names here
module.exports = {
  onceDocumentReady: create(),
  newOnReady: create,
};
