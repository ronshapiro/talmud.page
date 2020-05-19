const create = () => {
  return {
    ready: false,
    queue: [],
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
    },
  }
};

module.exports = {
  onceDocumentReady: create(),
  createForTesting: create,
};
