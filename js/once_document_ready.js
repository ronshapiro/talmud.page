const create = () => {
  const result = {
    execute(fn) {
      if (this.ready) {
        fn();
        return;
      }
      this.queue.push(fn);
    },
    declareReady() {
      if (this.ready) {
        throw new Error("Already ready!");
      }
      this.ready = true;
      this.queue.forEach(fn => fn());
      this.queue = [];
    },
    reset() {
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
