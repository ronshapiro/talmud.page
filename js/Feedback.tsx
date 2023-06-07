/* eslint-disable react/jsx-one-expression-per-line, react/jsx-curly-brace-presence */
import * as React from "react";
import {useHtmlRef} from "./hooks";
import {$} from "./jquery";
import {driveClient} from "./google_drive/singleton";
import {RetryMethodFactory} from "./retry";

const {
  useEffect,
  useState,
} = React;

interface TextFieldProps {
  isEmail?: boolean;
  id: string;
  hint: string;
  textArea?: boolean;
}

function TextField({isEmail, id, hint, textArea}: TextFieldProps): React.ReactElement {
  const element = [];
  if (textArea) {
    element.push(
      <textarea className="mdl-textfield__input" rows={3} id={id} key="input" />);
  } else {
    const inputType = isEmail ? "email" : "text";
    element.push(
      <input className="mdl-textfield__input" type={inputType} id={id} key="input" />);
  }
  return (
    <div
      id={`${id}-container`}
      key={`${id}-container`}
      className="mdl-textfield mdl-js-textfield"
      style={{
        display: "block",
        width: "100%",
      }}
    >
      {element}
      <label className="mdl-textfield__label" htmlFor={id}>{hint}</label>
    </div>
  );
}

interface PrimaryButtonProps {
  text: string;
  onClick: () => void;
}

function PrimaryButton({text, onClick}: PrimaryButtonProps): React.ReactElement {
  return (
    <button
      key="send"
      className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect mdl-button--accent"
      onClick={() => onClick()}>
      {text}
    </button>
  );
}

const retry = new RetryMethodFactory({
  add: (...args) => console.error(args),
  remove: (..._args) => {},
}, () => {});

const sendFeedbackRequest = retry.retryingMethod({
  retryingCall: (data: any) => {
    return $.ajax({
      type: "POST",
      url: `${window.location.origin}/feedback`,
      data: JSON.stringify(data),
      dataType: "json",
      contentType: "application/json",
    });
  },
});

interface FeedbackViewProps {
  hide: () => void;
}

export function FeedbackView({hide}: FeedbackViewProps): React.ReactElement {
  useEffect(() => {
    const darkMode = document.getElementById("darkModeCss") as HTMLStyleElement;
    if (darkMode) darkMode.disabled = true;
  });
  const rootRef = useHtmlRef<HTMLDivElement>();
  const collectData = () => {
    const data: any = {localStorage: {...localStorage}, form: {}};
    for (const input of $(rootRef.current).find(".mdl-textfield__input")) {
      data.form[input.id] = input.value;
    }
    if (driveClient.isSignedIn) {
      data.form.googleSignedInEmail = driveClient.gapi.getSignedInUserEmail();
    }
    data.form.url = window.location.href;
    sendFeedbackRequest(data);
  };

  const [showMore, setShowMore] = useState(false);
  const result = [
    <h2 key="header">Feedback</h2>,
    <p key="1">
      talmud.page is a hobby project by <a href="github.com/ronshapiro/talmud.page">Ron Shapiro</a>.
      Feedback is the best way to make improvements beyond my own usage.
      I&apos;d love to make it more widely useful!
    </p>,
    <p key="2">
      I&apos;d greatly appreciate you leaving your email so I can communicate offline at
      some point in the future.
    </p>,
    <TextField id="email" hint="Email" isEmail key="email" />,
  ];

  if (showMore) {
    const onSubmitFullForm = () => {
      collectData();
      localStorage.showFeedbackForm = "finished";
      hide();
    };
    result.push(
      <p key="p1">
        I&apos;d love a few more details if you&apos;re willing to share. Totally optional.
      </p>,
      <TextField key="3" id="name" hint="Name" />,
      <TextField key="4" id="location" hint="Where do you live?" />,
      <TextField key="5" id="usage" hint="How do you typically use talmud.page?" textArea />,
      <TextField
        key="6"
        id="feature_requests"
        hint="Do you have any requests? Any bugs to report?"
        textArea />,
      <PrimaryButton key="send" text="Send" onClick={() => onSubmitFullForm()} />);
  } else {
    const onFirstSubmit = () => {
      localStorage.showFeedbackForm = "submitted first level";
      collectData();
      setShowMore(true);
    };
    result.push(
      <div key="first buttons">
        <button
          className="mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect"
          onClick={() => {
            localStorage.showFeedbackForm = "ignored";
            hide();
          }}
          style={{opacity: .3}}>
          I&apos;d prefer not to.
        </button>
        <span style={{display: "inline-block", width: "20px"}} />
        <PrimaryButton
          onClick={() => onFirstSubmit()}
          text="I'd love to help!" />
      </div>);
  }

  return <div ref={rootRef}>{result}</div>;
}
