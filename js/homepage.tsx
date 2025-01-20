import * as React from "react";
import {render} from "react-dom";
import {SearchBar} from "./SearchBar";
import {LanguageChooser, Preferences} from "./Preferences";
import {useIncrementer} from "./hooks";
import {initializeLocalStorage} from "./initializeLocalStorage";

initializeLocalStorage();

const quote = '"';
function Examples() {
  return (
    <>
      <p style={{textAlign: "center"}}>
        <span className="lang-english">
          e.g.&nbsp;

          <span className="search-example">Brachot 2a,</span>&nbsp;
          <span className="search-example">ברכות ב,</span>&nbsp;

          <span className="search-example">Sukka 20a-21b,</span>&nbsp;
          <span className="search-example"><span dir="rtl">פסחים 30:</span>&nbsp;,</span>&nbsp;
          <span className="search-example">Shabbos 67b,</span>&nbsp;
          <span className="search-example">Bava Metzia 13b to 14a,</span>&nbsp;

          <br />
          <span className="search-example">Esther 6,</span>&nbsp;
          <span className="search-example">Orach Chaim 20</span>&nbsp;
        </span>

        <span className="lang-hebrew" dir="rtl">
          למשל:&nbsp;

          <span className="search-example">ברכות ב;</span>&nbsp;
          <span className="search-example">שבת ע{quote}ג,א;</span>&nbsp;

          <span className="search-example">סוכה 20-21;</span>&nbsp;
          <span className="search-example">פסחים 30:;</span>&nbsp;

          <br />
          <span className="search-example">אסתר א;</span>&nbsp;
          <span className="search-example">אורח חיים כ</span>&nbsp;
        </span>
      </p>
    </>
  );
}

function FooterInfo() {
  return (
    <>
      <p style={{textAlign: "center", marginTop: "40px"}}>
        <span className="lang-english">
          <a href="/browse">Browse Titles</a> &bull;&nbsp;
          <a href="mailto:feedback@talmud.page">Feedback</a>
        </span>
        <span className="lang-hebrew">
          <a href="/browse">חפש ספר</a> &bull;&nbsp;
          <a href="mailto:feedback@talmud.page">משוב</a>
        </span>
      </p>
      <p style={{textAlign: "center"}}>
        <span className="lang-english">
          <a href="/daf-yomi">Daf Yomi</a> &bull;&nbsp;
          <a href="/mishna-yomit">Mishna Yomit</a> &bull;&nbsp;
          <a href="/rambam-yomi">Rambam Yomi</a>
        </span>
        <span className="lang-hebrew">
          <a href="/daf-yomi">דף היומי</a> &bull;&nbsp;
          <a href="/mishna-yomit">משנה יומית</a> &bull;&nbsp;
          <a href="/rambam-yomi">רמב{quote}ם יומי</a>
        </span>
      </p>
    </>
  );
}

function Home() {
  const rerender = useIncrementer()[1];
  return (
    <>
      <LanguageChooser rerender={rerender} padding="0px">
        <>
          <br />
          <h1 className="lang-english">Read the Talmud</h1>
          <h1 className="lang-hebrew">talmud.page</h1>
        </>
      </LanguageChooser>

      <SearchBar />
      <Preferences rerender={rerender} />

      <br />
      <Examples />
      <FooterInfo />
    </>
  );
}

render(<Home />, document.getElementById("center-contents"));
