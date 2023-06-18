/* global gtag */
import * as React from "react";
import {CorrectionUiInfo} from "../correctionTypes";
import {useHtmlRef} from "./hooks";
import Modal from "./Modal";
import {postWithRetry} from "./post";
import {driveClient} from "./google_drive/singleton";

const {
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

export function CorrectionModal(): React.ReactElement | null {
  const [isShowing, setShowing] = useState(false);
  const [refData, setRefData] = useState({});
  window.showCorrectionModal = (data: CorrectionUiInfo) => {
    setShowing(true);
    setRefData(data);
  };
  const ref = useHtmlRef<HTMLTextAreaElement>();

  if (!isShowing) {
    return null;
  }

  const onSubmit = (event?: any) => {
    if (event) event.preventDefault();
    const userText = ref.current.value;
    postWithRetry("/corrections", {
      ...refData,
      userText,
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
              <textarea ref={ref} className="mdl-textfield__input" rows={5} />
            </div>
          </form>
        </div>
      )}
      cancelText="Cancel"
      onCancel={() => setShowing(false)}
      acceptText="Submit Correction"
      onAccept={() => onSubmit()} />
  );
}
