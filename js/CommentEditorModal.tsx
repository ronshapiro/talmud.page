import * as React from "react";
import {v4 as uuid} from "uuid";
import {useHtmlRef} from "./hooks";
import Modal, {ModalEditor, useTextDirectionButton} from "./Modal";

const {
  useEffect,
  useState,
} = React;

interface ModalData {
  title: string;
  initialText: string;
  onSave: (text: string) => void;
  direction: "rtl" | "ltr";
}

declare global {
  interface Window {
    showCommentEditorModal: (data: ModalData) => void
  }
}
export function showCommentEditorModal(data: ModalData): void {
  window.showCommentEditorModal(data);
}

export function CommentEditorModal(): React.ReactElement | null {
  const [isShowing, setShowing] = useState(false);
  const [data, setModalData] = useState<ModalData | undefined>();
  const {direction, setDirection, directionButton} = useTextDirectionButton();
  const [displayId, setDisplayId] = useState("");
  window.showCommentEditorModal = (modalData: ModalData) => {
    setShowing(true);
    setModalData(modalData);
    setDirection(modalData.direction);
    setDisplayId(uuid());
  };
  const ref = useHtmlRef<HTMLTextAreaElement>();
  useEffect(() => {
    if (ref.current) {
      ref.current.value = data!.initialText;
    }
  }, [displayId]);

  if (!isShowing || !data) {
    return null;
  }

  const onSubmit = (event?: any) => {
    if (event) event.preventDefault();
    data.onSave(ref.current.value);
    setShowing(false);
  };

  return (
    <Modal
      content={(
        <ModalEditor
          title={data.title}
          onSubmit={(event) => onSubmit(event)}
          direction={direction}
          textAreaRef={ref}
        />
      )}
      cancelText="Cancel"
      onCancel={() => setShowing(false)}
      acceptText="Save"
      onAccept={() => onSubmit()}
      extraButtons={[directionButton]}
      />
  );
}
