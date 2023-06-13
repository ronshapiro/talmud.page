import {$} from "./jquery";
import {RetryMethodFactory} from "./retry";

const retry = new RetryMethodFactory({
  add: (...args) => console.error(args),
  remove: (..._args) => {},
}, () => {});

export const sendEvent = retry.retryingMethod({
  retryingCall: (data: any) => {
    return $.ajax({
      type: "POST",
      url: `${window.location.origin}/event`,
      data: JSON.stringify(data),
      dataType: "json",
      contentType: "application/json",
    });
  },
});
