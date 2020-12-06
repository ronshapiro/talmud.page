export function promiseParts<T>(): [Promise<T>, (t: T) => void, (t: T) => void] {
  let onSuccess = (_t: T) => {};
  let onError = (_t: T) => {};
  const promise = new Promise<T>((success, error) => {
    onSuccess = success;
    onError = error;
  });
  return [promise, onSuccess, onError];
}

export function asPromise(thenable: any): Promise<any> {
  return Promise.all([thenable]).then(x => x[0]);
}
