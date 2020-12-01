/* global componentHandler */
import React, {
  useRef,
  useEffect,
} from "react";
import $ from "jquery";
import PropTypes from 'prop-types';

function Modal(props) {
  const {
    label,
    content,
    cancelText,
    onCancel,
    acceptText,
    onAccept,
  } = props;
  const modalContainerRef = useRef();
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
          <span>{label}</span>
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
  label: PropTypes.string,
  content: PropTypes.node,
  cancelText: PropTypes.string,
  onCancel: PropTypes.func,
  acceptText: PropTypes.string,
  onAccept: PropTypes.func,
};

export default Modal;
