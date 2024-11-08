import * as React from "react";
import {postCorrection} from "./corrections";
import {CorrectionUiInfo} from "../correctionTypes";
import {useHtmlRef} from "./hooks";
import Modal from "./Modal";

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
  const [refData, setRefData] = useState<CorrectionUiInfo | undefined>();
  window.showCorrectionModal = (data: CorrectionUiInfo) => {
    setShowing(true);
    setRefData(data);
  };
  const ref = useHtmlRef<HTMLTextAreaElement>();
  const [isRtl, setIsRtl] = useState(false);
  const direction = isRtl ? "rtl" : "ltr";

  if (!isShowing) {
    return null;
  }

  const onSubmit = (event?: any) => {
    if (event) event.preventDefault();
    postCorrection({...refData!, userText: ref.current.value});
    setShowing(false);
  };

  return (
    <Modal
      content={(
        <div>
          <p><strong>Submit a correction to Sefaria:</strong></p>
          <form onSubmit={(event) => onSubmit(event)}>
            <div
              className="mdl-textfield mdl-js-textfield
                         mdl-textfield--expandable
                         mdl-textfield--floating-label">
              <textarea dir={direction} ref={ref} className="mdl-textfield__input" rows={5} />
            </div>
          </form>
        </div>
      )}
      cancelText="Cancel"
      onCancel={() => setShowing(false)}
      acceptText="Submit Correction"
      onAccept={() => onSubmit()}
      extraButtons={[
        <button
          key="direction"
          onClick={() => () => setIsRtl(!isRtl)}
          className="mdl-button mdl-js-button modal-direction-button">
          <i className="material-icons">
            {isRtl ? "format_textdirection_r_to_l" : "format_textdirection_l_to_r"}
          </i>
        </button>,
      ]}
      />
  );
}
