import * as React from "react";
import {postCorrection} from "./corrections";
import {CorrectionUiInfo} from "../correctionTypes";
import {useHtmlRef} from "./hooks";
import Modal, {ModalEditor, useTextDirectionButton} from "./Modal";

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
  const {direction, directionButton} = useTextDirectionButton();

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
        <ModalEditor
          title="Submit a correction to Sefaria:"
          titleHebrew="להציע תיקון לספריא"
          onSubmit={(event) => onSubmit(event)}
          direction={direction}
          textAreaRef={ref}
        />
      )}
      cancelText="Cancel"
      cancelTextHebrew="בטל"
      onCancel={() => setShowing(false)}
      acceptText="Submit Correction"
      acceptTextHebrew="שלח תיקון"
      onAccept={() => onSubmit()}
      extraButtons={[directionButton]}
      />
  );
}
