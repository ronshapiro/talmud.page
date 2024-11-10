import * as React from "react";
import * as PropTypes from 'prop-types';
import {$} from "./jquery";
import {NullaryFunction} from "./types";
import componentHandler from "./componentHandler";
import {useHtmlRef} from "./hooks";

const {
  useEffect,
  useState,
} = React;

interface ModalProps {
  content: React.ReactNode;
  cancelText: string;
  onCancel: NullaryFunction<void>;
  acceptText: string;
  onAccept: NullaryFunction<void>;
  extraButtons?: React.ReactElement[];
}

export default function Modal(props: ModalProps): React.ReactElement {
  const {
    content,
    cancelText,
    onCancel,
    acceptText,
    onAccept,
    extraButtons,
  } = props;
  const modalContainerRef = useHtmlRef<HTMLInputElement>();
  useEffect(() => {
    componentHandler.upgradeElement(modalContainerRef.current);
    const modalContainer = $(modalContainerRef.current);
    modalContainer.click((event: any) => {
      if (event.target === modalContainer[0]) {
        onCancel();
      }
    });
    modalContainer.find("input, textarea").first().focus();
  });

  return (
    <div className="modal-container" ref={modalContainerRef}>
      <div className="modal">
        <div className="modal-content">
          {content}
          <div style={{display: "flex"}}>
            {extraButtons}
            <button
              className="mdl-button mdl-js-button mdl-js-ripple-effect modal-cancel"
              style={{marginLeft: "auto"}}
              onClick={() => onCancel()}>
              {cancelText}
            </button>
            <button
              className="mdl-button mdl-js-button mdl-js-ripple-effect mdl-button--accent"
              onClick={() => onAccept()}>
              {acceptText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
Modal.propTypes = {
  content: PropTypes.node,
  cancelText: PropTypes.string,
  onCancel: PropTypes.func,
  acceptText: PropTypes.string,
  onAccept: PropTypes.func,
};

type Direction = "ltr" | "rtl";

export function ModalEditor({
  title,
  onSubmit,
  direction,
  textAreaRef,
}: {
  title: string;
  onSubmit: (event: React.FormEvent) => void;
  direction: Direction;
  textAreaRef?: React.MutableRefObject<HTMLTextAreaElement>;
}): React.ReactElement {
  return (
    <div>
      <p><strong>{title}</strong></p>
      <form onSubmit={(event) => onSubmit(event)}>
        <div
          className="mdl-textfield mdl-js-textfield
                     mdl-textfield--expandable
                     mdl-textfield--floating-label">
          <textarea dir={direction} ref={textAreaRef} className="mdl-textfield__input" rows={5} />
        </div>
      </form>
    </div>
  );
}
ModalEditor.propTypes = {
  title: PropTypes.string.isRequired,
  onSubmit: PropTypes.func.isRequired,
  direction: PropTypes.string.isRequired,
  textAreaRef: PropTypes.object,
};


export function useTextDirectionButton(): [Direction, React.ReactElement] {
  const [isRtl, setIsRtl] = useState(false);
  const button = (
    <button
      key="direction"
      onClick={() => setIsRtl(!isRtl)}
      className="mdl-button mdl-js-button modal-direction-button">
      <i className="material-icons">
        {isRtl ? "format_textdirection_r_to_l" : "format_textdirection_l_to_r"}
      </i>
    </button>);
  return [isRtl ? "rtl" : "ltr", button];
}
