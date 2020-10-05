const create = () => {
  const result = {
    execute(fn) {
      let resolve;
      let reject;
      const promise = new Promise((captureResolve, captureReject) => {
        resolve = captureResolve;
        reject = captureReject;
      });

      const wrapped = () => {
        try {
          fn();
          resolve();
        } catch (e) {
          reject(e);
        }
      };

      if (this.ready) {
        wrapped();
      } else {
        this.queue.push(wrapped);
      }
      return promise;
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
