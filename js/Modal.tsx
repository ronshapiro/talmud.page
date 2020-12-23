import * as React from "react";
import $ from "jquery";
import * as PropTypes from 'prop-types';
import {NullaryFunction} from "./types";
import componentHandler from "./componentHandler";
import {useHtmlRef} from "./hooks";

const {useEffect} = React;

interface ModalProps {
  content: React.ReactNode;
  cancelText: string;
  onCancel: NullaryFunction<void>;
  acceptText: string;
  onAccept: NullaryFunction<void>;
}

export default function Modal(props: ModalProps): React.ReactElement {
  const {
    content,
    cancelText,
    onCancel,
    acceptText,
    onAccept,
  } = props;
  const modalContainerRef = useHtmlRef();
  useEffect(() => {
    componentHandler.upgradeElement(modalContainerRef.current);
    const modalContainer = $(modalContainerRef.current);
    modalContainer.click((event) => {
      if (event.target === modalContainer[0]) {
        onCancel();
      }
    });
  });

  return (
    <div className="modal-container" ref={modalContainerRef}>
      <div className="modal">
        <div className="modal-content">
          {content}
          <div style={{display: "flex"}}>
            <button
              className="mdl-button mdl-js-button mdl-js-ripple-effect"
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
