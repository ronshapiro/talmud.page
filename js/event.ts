import {postWithRetry} from "./post";

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function sendEvent(data: any): void {
  postWithRetry("/event", data);
}
