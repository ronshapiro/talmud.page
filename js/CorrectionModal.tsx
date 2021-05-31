/* global gtag */
import * as React from "react";
import {CorrectionUiInfo} from "../correctionTypes";
import {driveClient} from "./google_drive/singleton";
import {$} from "./jquery";
import Modal from "./Modal";
import {RetryMethodFactory} from "./retry";

const {
  useRef,
  useState,
} = React;

declare global {
  interface Window {
    showCorrectionModal: (data: CorrectionUiInfo) => void
  }
}

export function showCorrectionModal(data: CorrectionUiInfo): void {
  window.showCorrectionModal(data);
}

const retry = new RetryMethodFactory({
  add: (...args) => console.error(args),
  remove: (..._args) => {},
}, () => {});

const makeRequest = retry.retryingMethod({
  retryingCall: (data: any) => {
    return $.ajax({
      type: "POST",
      url: `${window.location.origin}/corrections`,
      data: JSON.stringify(data),
      dataType: "json",
      contentType: "application/json",
    });
  },
});

export function CorrectionModal(): React.ReactElement | null {
  const [isShowing, setShowing] = useState(false);
  const [refData, setRefData] = useState({});
  window.showCorrectionModal = (data: CorrectionUiInfo) => {
    setShowing(true);
    setRefData(data);
  };
  const ref = useRef<HTMLInputElement>(undefined as any);

  if (!isShowing) {
    return null;
  }

  const onSubmit = (event?: any) => {
    if (event) event.preventDefault();
    makeRequest({
      ...refData,
      userText: ref.current.value,
      user: driveClient.gapi.getSignedInUserEmail(),
    });
    setShowing(false);
    gtag("event", "report_correction", {ref});
  };

  return (
    <Modal
      content={(
        <div>
          <p><strong>Submit a correction to Sefaria:</strong></p>
          <form onSubmit={(event) => onSubmit(event)}>
            <div
              className="mdl-textfieldmdl-js-textfield
                         mdl-textfield--expandable
                         mdl-textfield--floating-label">
              <input ref={ref} className="mdl-textfield__input" type="text" />
            </div>
          </form>
        </div>
      )}
      cancelText="Cancel"
      onCancel={() => setShowing(false)}
      acceptText="Submit"
      onAccept={() => onSubmit()} />
  );
}
