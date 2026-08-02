import * as React from "react";
import {QueryGuess} from "../apiTypes";
import {disableBackButtonProtection} from "./block_back_button";
import {useHtmlRef} from "./hooks";
import {$} from "./jquery";
import {NullaryFunction} from "./types";
import {upgradeElement} from "./componentHandler";
import {isSiteLanguageHebrew} from "./settings";

const {
  useEffect,
  useState,
} = React;

interface SearchBarPropTypes {
  defaultValue?: string;
  submitRef?: React.MutableRefObject<NullaryFunction<unknown> | undefined>;
}

export function SearchBar({
  defaultValue,
  submitRef,
}: SearchBarPropTypes): React.ReactElement {
  const ref = useHtmlRef<HTMLInputElement>();
  const formRef = useHtmlRef<HTMLDivElement>();
  const [searchError, setSearchError] = useState<any>({});
  const [guesses, setGuesses] = useState<QueryGuess[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [hasError, setError] = useState(false);
  const [hasSetDefaultValue, setDefaultValueSet] = useState(false);

  const onSubmit = (event?: any) => {
    if (event) event.preventDefault();
    setLoading(true);

    const handler = (response: any) => {
      let path = (response.path as string);
      if (path) {
        if (path.startsWith("/")) path = path.slice(1);
        disableBackButtonProtection();
        window.location.href = `${window.location.origin}/${path}`;
      }
      setSearchError(response);
      setGuesses(response.guesses ?? []);
      setLoading(false);
      setError(false);
    };

    const query = ref.current.value;
    if (query === "") {
      handler({});
    } else {
      $.ajax({url: `${window.location.origin}/api/search/${query}`, type: "GET"})
        .fail(() => {
          setSearchError({});
          setGuesses([]);
          setLoading(false);
          setError(true);
        })
        .then(handler);
    }
  };
  if (submitRef) {
    submitRef.current = onSubmit;
  }
  const useHebrew = isSiteLanguageHebrew();
  const direction = useHebrew ? "rtl" : "ltr";
  const textAlign = useHebrew ? "right" : "left";

  const suffixHtml = [];
  if (guesses.length > 0) {
    const didYouMean = useHebrew ? "האם התכוונת ל" : "Did you mean";
    suffixHtml.push(
      <div key="suggestions" dir={direction}>
        <span>{didYouMean}: </span>
        {guesses
          .flatMap(guess => [<a key={guess.url} href={guess.url}>{guess.text}</a>, ", "])
          .slice(0, -1)
          .concat(["?"])}
      </div>,
    );
  } else if (hasError) {
    suffixHtml.push(useHebrew ? "שגיאה" : "Error while running");
  }

  useEffect(() => {
    // Not sure the right way to format the default value in Hebrew yet
    if (!hasSetDefaultValue && defaultValue && !useHebrew) {
      ref.current.value = defaultValue;
      setDefaultValueSet(true);
    }
    upgradeElement(formRef.current);
  });


  const search = useHebrew ? "חפש" : "Search";
  const searchErrorText = (useHebrew ? searchError.errorHebrew : searchError.error) ?? "";

  return (
    <>
      <form
        onSubmit={event => onSubmit(event)}
        style={{display: "flex"}}
        dir={direction}
        >
        <div
          ref={formRef}
          className="mdl-textfield
                     mdl-js-textfield
                     mdl-textfield--expandable
                     mdl-textfield--floating-label"
          style={{flexGrow: 1}}>
          <input
            className="mdl-textfield__input"
            type="text"
            id="search_term"
            name="search_term"
            style={{textAlign}}
            ref={ref} />
          { /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
          <label
            className="mdl-textfield__label"
            style={{textAlign}}
            htmlFor="search_term">
            {search}
          </label>
        </div>
        <span
          className="mdl-spinner mdl-spinner--single-color mdl-js-spinner is-active"
          style={{
            display: isLoading ? "inherit" : "none",
            top: "16px",
            marginLeft: "16px",
          }} />

      </form>
      {suffixHtml}
      <span className="search-error">{searchErrorText}</span>
    </>
  );
}
