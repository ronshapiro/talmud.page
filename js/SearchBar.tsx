import * as React from "react";
import {disableBackButtonProtection} from "./block_back_button";
import {useHtmlRef} from "./hooks";
import {$} from "./jquery";
import {QueryGuess} from "../apiTypes";

const {useState} = React;

export function SearchBar(): React.ReactElement {
  const ref = useHtmlRef<HTMLInputElement>();
  const [searchError, setSearchError] = useState("");
  const [guesses, setGuesses] = useState<QueryGuess[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [hasError, setError] = useState(false);

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
      setSearchError(response.error ?? "");
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
          setSearchError("");
          setGuesses([]);
          setLoading(false);
          setError(true);
        })
        .then(handler);
    }
  };

  const suffixHtml = [];
  if (guesses.length > 0) {
    suffixHtml.push(
      <div key="suggestions">
        <span>Did you mean: </span>
        {guesses
          .flatMap(guess => [<a key={guess.url} href={guess.url}>{guess.text}</a>, ", "])
          .slice(0, -1)
          .concat(["?"])}
      </div>,
    );
  } else if (hasError) {
    suffixHtml.push("Error while running");
  }

  return (
    <>
      <form onSubmit={event => onSubmit(event)} style={{display: "flex"}}>
        <div
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
            ref={ref} />
          { /* eslint-disable-next-line jsx-a11y/label-has-associated-control */ }
          <label
            className="mdl-textfield__label"
            htmlFor="search_term">
            Search
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
      <span className="search-error">{searchError}</span>
    </>
  );
}
