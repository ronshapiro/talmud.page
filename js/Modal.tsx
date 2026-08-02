import * as React from "react";
import * as PropTypes from 'prop-types';
import {$} from "./jquery";
import {NullaryFunction} from "./types";
import componentHandler from "./componentHandler";
import {useHtmlRef} from "./hooks";
import {isSiteLanguageHebrew} from "./settings";

const {
  useEffect,
  useState,
} = React;

interface ModalProps {
  content: React.ReactNode;
  cancelText: string;
  cancelTextHebrew: string;
  onCancel: NullaryFunction<void>;
  acceptText: string;
  acceptTextHebrew: string;
  onAccept: NullaryFunction<void>;
  extraButtons?: React.ReactElement[];
  isBottom?: boolean;
}

export default function Modal(props: ModalProps): React.ReactElement {
  const {
    content,
    onCancel,
    onAccept,
    extraButtons,
    isBottom,
  } = props;
  const cancelText = (
    isSiteLanguageHebrew() ? props.cancelTextHebrew : props.cancelText);
  const acceptText = (
    isSiteLanguageHebrew() ? props.acceptTextHebrew : props.acceptText);
  const modalContainerRef = useHtmlRef<HTMLInputElement>();
  useEffect(() => {
    componentHandler.upgradeElement(modalContainerRef.current);
    const modalContainer = $(modalContainerRef.current);
    modalContainer.click((event: any) => {
      if (event.target === modalContainer[0]) {
        onCancel();
      }
    });
    const {activeElement} = document;
    if (!activeElement || (
      activeElement.tagName !== "INPUT" && activeElement.tagName !== "TEXTAREA")) {
      modalContainer.find("input, textarea").first().focus();
    }
  });

  const marginStartStyle = (
    isSiteLanguageHebrew() ? {marginRight: "auto"} : {marginLeft: "auto"});

  return (
    <div
      className="modal-container"
      ref={modalContainerRef}
      dir={isSiteLanguageHebrew() ? "rtl" : "ltr"}>
      <div className={`modal${isBottom ? " modal-bottom" : ""}`}>
        <div className="modal-content">
          {content}
          <div style={{display: "flex"}}>
            <button
              className="mdl-button mdl-js-button mdl-js-ripple-effect modal-cancel"
              style={marginStartStyle}
              onClick={() => onCancel()}>
              {cancelText}
            </button>
            {extraButtons}
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
  titleHebrew,
  onSubmit,
  direction,
  textAreaRef,
}: {
  title: string;
  titleHebrew: string;
  onSubmit: (event: React.FormEvent) => void;
  direction: Direction;
  textAreaRef?: React.MutableRefObject<HTMLTextAreaElement>;
}): React.ReactElement {
  return (
    <div>
      <strong>{isSiteLanguageHebrew() ? titleHebrew : title}</strong>
      <form onSubmit={(event) => onSubmit(event)}>
        <div
          style={{padding: "0"}}
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
  titleHebrew: PropTypes.string.isRequired,
  onSubmit: PropTypes.func.isRequired,
  direction: PropTypes.string.isRequired,
  textAreaRef: PropTypes.object,
};


interface TextDirectionButton {
  direction: Direction;
  setDirection: (direction: Direction) => void;
  directionButton: React.ReactElement;
}
export function useTextDirectionButton(): TextDirectionButton {
  const [isRtl, setIsRtl] = useState(isSiteLanguageHebrew());
  const button = (
    <button
      key="direction"
      onClick={() => setIsRtl(!isRtl)}
      className="mdl-button mdl-js-button modal-direction-button">
      <i className="material-icons">
        {isRtl ? "format_textdirection_r_to_l" : "format_textdirection_l_to_r"}
      </i>
    </button>);
  return {
    direction: isRtl ? "rtl" : "ltr",
    setDirection: direction => setIsRtl(direction === "rtl"),
    directionButton: button,
  };
}
