import * as React from "react";
import * as PropTypes from 'prop-types';
import {onClickKeyListener} from "./key_clicks";
import {NavigationExtension} from "./NavigationExtension";
import Modal from "./Modal";
import {NullaryFunction} from "./types";
import {SearchBar} from "./SearchBar";

const {
  useRef,
  useState,
} = React;

const buttonClasses = (...extra: string[]) => {
  return [
    "navigation-button",
    "mdl-button",
    "mdl-js-button",
    "mdl-button--raised",
    "mdl-js-ripple-effect",
    "mdl-button--colored",
    ...extra,
  ].join(" ");
};

interface NavigationButtonRowProps {
  isNext: boolean;
  text: string;
  doLoad: NullaryFunction<void>;
  defaultEditText: NullaryFunction<string>;
}

const NavigationButtonRow = (props: NavigationButtonRowProps) => {
  const {
    isNext,
    text,
    doLoad,
    defaultEditText,
  } = props;
  const [showModal, setShowModal] = useState(false);
  const classes = ["navigation-button-container"];
  const submitRef = useRef<NullaryFunction<unknown>>();

  if (isNext) classes.push("next");

  return (
    <div className={classes.join(" ")}>
      <span
        className={buttonClasses()}
        onClick={() => doLoad()}
        onKeyUp={onClickKeyListener(doLoad)}
        role="button"
        tabIndex={0}>
        {text}
      </span>
      <button
        className="mdl-button mdl-js-button mdl-button--icon mdl-button edit-button"
        onClick={() => setShowModal(true)}>
        <i className="material-icons">edit</i>
      </button>
      {showModal && (
        <Modal
          content={<SearchBar defaultValue={defaultEditText()} submitRef={submitRef} />}
          cancelText="Cancel"
          onCancel={() => setShowModal(false)}
          acceptText="Navigate"
          onAccept={() => submitRef.current!()} />
      )}
    </div>
  );
};
NavigationButtonRow.propTypes = {
  isNext: PropTypes.bool.isRequired,
  text: PropTypes.string.isRequired,
  doLoad: PropTypes.func.isRequired,
  defaultEditText: PropTypes.func.isRequired,
};

interface ButtonProps {
  navigationExtension: NavigationExtension;
}

export const PreviousButton = (props: ButtonProps): React.ReactElement | null => {
  const {navigationExtension} = props;
  if (!navigationExtension.hasPrevious()) {
    return null;
  }
  return (
    <NavigationButtonRow
      isNext={false}
      text={`Load ${navigationExtension.previous().replace(/_/g, " ")}`}
      doLoad={() => navigationExtension.loadPrevious()}
      defaultEditText={() => navigationExtension.defaultEditText()}
    />
  );
};
PreviousButton.propTypes = {
  navigationExtension: PropTypes.object.isRequired,
};

export const NextButton = (props: ButtonProps): React.ReactElement | null => {
  const {navigationExtension} = props;
  if (!navigationExtension.hasNext()) {
    return null;
  }
  return (
    <NavigationButtonRow
      isNext
      text={`Load ${navigationExtension.next().replace(/_/g, " ")}`}
      doLoad={() => navigationExtension.loadNext()}
      defaultEditText={() => navigationExtension.defaultEditText()}
    />
  );
};
NextButton.propTypes = PreviousButton.propTypes;
