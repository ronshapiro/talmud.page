import {$} from "./jquery";
import {RetryMethodFactory} from "./retry";

const retry = new RetryMethodFactory({
  add: (...args) => console.error(args),
  remove: (..._args) => {},
}, () => {});


export function post(endpoint: string, data: unknown): Promise<any> {
  return Promise.resolve($.ajax({
    type: "POST",
    url: `${window.location.origin}${endpoint}`,
    data: JSON.stringify(data),
    dataType: "json",
    contentType: "application/json",
  }));
}

export const postWithRetry = retry.retryingMethod({
  retryingCall: (endpoint: string, data: any) => {
    return $.ajax({
      type: "POST",
      url: `${window.location.origin}${endpoint}`,
      data: JSON.stringify(data),
      dataType: "json",
      contentType: "application/json",
    });
  },
});
