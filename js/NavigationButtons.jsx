import React, {
  useRef,
  useState,
} from "react";
import PropTypes from 'prop-types';
import Modal from "./Modal.jsx";

const buttonClasses = (...extra) => {
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

const newSearch = searchTerm => {
  const form = document.createElement("form");
  document.body.appendChild(form);
  form.method = "post";
  form.action = `${window.location.origin}/view_daf`;
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = "search_term";
  input.value = searchTerm;
  form.appendChild(input);
  form.submit();
};

const NavigationButtonRow = (props) => {
  const {
    isNext,
    text,
    doLoad,
  } = props;
  const [showModal, setShowModal] = useState(false);
  const classes = ["navigation-button-container"];
  const modalSearchBarRef = useRef();

  if (isNext) classes.push("next");
  return (
    <div className={classes.join(" ")}>
      <span className={buttonClasses()} onClick={() => doLoad()}>
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
            <form>
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
          onAccept={() => {
            // TODO: only reload if the masechet is different.
            // Otherwise stay on the same page. Or even better, just recreate the drive client!
            newSearch(modalSearchBarRef.current.value);
          }} />
      )}
    </div>
  );
};
NavigationButtonRow.propTypes = {
  isNext: PropTypes.bool.isRequired,
  text: PropTypes.string.isRequired,
  doLoad: PropTypes.func.isRequired,
};


const PreviousButton = (props) => {
  const {navigationExtension} = props;
  if (!navigationExtension.hasPrevious()) {
    return null;
  }
  return (
    <NavigationButtonRow
      isNext={false}
      text={`Load ${navigationExtension.previous()}`}
      doLoad={() => navigationExtension.loadPrevious()}
    />
  );
};
PreviousButton.propTypes = {
  navigationExtension: PropTypes.object.isRequired,
};

const NextButton = (props) => {
  const {navigationExtension} = props;
  if (!navigationExtension.hasNext()) {
    return null;
  }
  return (
    <NavigationButtonRow
      isNext
      text={`Load ${navigationExtension.next()}`}
      doLoad={() => navigationExtension.loadNext()}
    />
  );
};
NextButton.propTypes = PreviousButton.propTypes;

module.exports = {
  NextButton,
  PreviousButton,
};
