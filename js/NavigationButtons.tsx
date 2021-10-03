import * as React from "react";
import * as PropTypes from 'prop-types';
import {disableBackButtonProtection} from "./block_back_button";
import {$} from "./jquery";
import {NavigationExtension} from "./NavigationExtension";
import Modal from "./Modal";
import {NullaryFunction} from "./types";

const {
  useEffect,
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

const newSearch = (searchTerm: string): void => {
  const form = document.createElement("form");
  document.body.append(form);
  form.method = "post";
  form.action = `${window.location.origin}/view_daf`;
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "search_term";
  input.value = searchTerm;
  form.append(input);
  form.submit();
};

interface NavigationButtonRowProps {
  isNext: boolean;
  text: string;
  doLoad: NullaryFunction<void>;
  defaultEditText: NullaryFunction<string>;
}

const VALID_CLICK_KEY_CODES = new Set(["Enter", " "]);

const NavigationButtonRow = (props: NavigationButtonRowProps) => {
  const {
    isNext,
    text,
    doLoad,
    defaultEditText,
  } = props;
  const [showModal, setShowModal] = useState(false);
  const classes = ["navigation-button-container"];
  const modalSearchBarRef = useRef<HTMLInputElement>(undefined as any);

  useEffect(() => {
    $(modalSearchBarRef.current).val(defaultEditText());
  });

  if (isNext) classes.push("next");

  const onSubmit = (event?: any) => {
    if (event) event.preventDefault();
    disableBackButtonProtection();
    newSearch(modalSearchBarRef.current.value);
  };

  return (
    <div className={classes.join(" ")}>
      <span
        className={buttonClasses()}
        onClick={() => doLoad()}
        onKeyUp={(e: any) => VALID_CLICK_KEY_CODES.has(e.key) && doLoad()}
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
          content={(
            <form onSubmit={event => onSubmit(event)}>
              <div
                className="mdl-textfieldmdl-js-textfield
                           mdl-textfield--expandable
                           mdl-textfield--floating-label">
                <input ref={modalSearchBarRef} className="mdl-textfield__input" type="text" />
              </div>
            </form>
          )}
          cancelText="Cancel"
          onCancel={() => setShowModal(false)}
          acceptText="Navigate"
          onAccept={() => onSubmit()} />
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
