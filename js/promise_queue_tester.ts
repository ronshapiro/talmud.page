/* eslint-disable no-console */
import {PromiseQueue, timeoutPromise} from "./promises";

function test(q: PromiseQueue, count: number, delayFunc: (_: number) => number) {
  const start = Date.now();
  for (let i = 1; i < count; i++) {
    q.add(() => {
      return timeoutPromise(delayFunc(i)).then(() => console.log(i, Date.now() - start));
    });
  }
}

/*
console.log("Chain");
test(new PromiseQueue(1), 30, _ => 100);
*/

/*
console.log("Every 1 second");
test(new PromiseQueue(3), 30, _ => 1000);
*/

console.log("Progressing");
test(new PromiseQueue(3), 20, i => i * 1000);
