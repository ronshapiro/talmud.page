import * as React from "react";
import {render} from 'react-dom';
import {zip} from "underscore";
import {Book, Category, browseIndex} from "./BrowseIndex";
import {useIncrementer} from "./hooks";
import {Preferences, LanguageChooser} from "./Preferences";

interface Color {
  r: number;
  g: number;
  b: number;
}

function withGradient<T>(endRgb: Color, items: T[]): [T, string][] {
  const numColors = items.length;
  const numSteps = Math.floor(numColors * 1.5) + 1;
  const startRgb = {r: 200, g: 200, b: 200};
  const colorStep = {
    r: (endRgb.r - startRgb.r) / (numSteps - 1),
    g: (endRgb.g - startRgb.g) / (numSteps - 1),
    b: (endRgb.b - startRgb.b) / (numSteps - 1),
  };

  const colors: string[] = [];
  for (let i = 0; i < numSteps; i++) {
    const r = Math.round(startRgb.r + i * colorStep.r);
    const g = Math.round(startRgb.g + i * colorStep.g);
    const b = Math.round(startRgb.b + i * colorStep.b);
    colors.push(`rgb(${r}, ${g}, ${b})`);
  }

  return zip(items, colors.slice(-1 * numColors)) as [T, string][];
}

function BackButton({onClick}: {onClick: () => void}): React.ReactElement {
  const useHebrew = localStorage.languageOption === "hebrew";
  const style: any = {
    position: "fixed",
    top: useHebrew ? "10px" : "50px",
    padding: "30px",
  };
  style[useHebrew ? "right" : "left"] = "10px";

  return (
    <button
      style={style}
      className="mdl-button mdl-js-button mdl-button--icon mdl-js-ripple-effect"
      onClick={onClick}>
      <i className="material-icons">{useHebrew ? "arrow_forward" : "arrow_back"}</i>
    </button>
  );
}

const BUTTON_CLASSES = "mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect";
function ItemElement({
  text,
  color,
  onClick,
  width,
}: {
  text: string | React.ReactElement;
  color: string;
  onClick: () => void;
  width?: string;
}): React.ReactElement {
  return (
    <button
      style={{
        width: width ?? "200px",
        padding: "10px 20px",
        height: "unset",
        lineHeight: "18px",
        background: color,
        alignItems: "stretch",
      }}
      onClick={onClick}
      className={BUTTON_CLASSES}>
      {text}
    </button>
  );
}

const CATEGORIES_COLOR = {r: 246, g: 221, b: 194};
const BLUE = {r: 205, g: 121, b: 61};
const SECTIONS_COLOR = {r: 185, g: 135, b: 255};

function isCategory(x: Book | Category): x is Category {
  return (x as Category).contents !== undefined;
}

function Grid(): React.ReactElement {
  const useHebrew = localStorage.languageOption === "hebrew";
  const rerender = useIncrementer()[1];
  const items = [];
  const extension = window.location.pathname.slice("/browse".length).slice(1).replace(/_/g, " ");
  let pageTitle: string | React.ReactElement = extension;
  let back: (() => void) | undefined;

  const routerTo = (...paths: string[]) => {
    return () => {
      const suffix = paths.join("/");
      window.location.assign(`${window.location.origin}/${suffix.replace(/ /g, "_")}`);
      rerender();
    };
  };

  if (extension === "") {
    for (const [category, color] of withGradient(CATEGORIES_COLOR, browseIndex.categories)) {
      const onClick = routerTo("browse", category.english);
      const text = useHebrew ? category.hebrew : category.english;
      items.push(<ItemElement key={text} text={text} onClick={onClick} color={color} />);
    }
    pageTitle = useHebrew ? "בחר" : "Browse";
  } else {
    const container = browseIndex.index[extension];
    if (!container) {
      back = routerTo("browse");
      const error = useHebrew ? "לא זוהה" : "No title or category";
      pageTitle = <span style={{color: "red"}}>{error}: &quot;{extension}&quot;</span>;
    } else if (isCategory(container)) {
      back = routerTo("browse");
      for (const [title, color] of withGradient(BLUE, container.contents)) {
        const book = browseIndex.index[title] as Book;
        const text = useHebrew
          ? book.indexSubcategoryHebrewTitle
          : <>{book.indexSubcategoryTitle}<br />{book.indexSubcategoryHebrewTitle}</>;
        const onClick = extension === "Prayer"
          ? routerTo(title)
          : routerTo("browse", title);
        items.push(<ItemElement key={title} text={text} onClick={onClick} color={color} />);
      }
      const category = browseIndex.categories.find(
        x => x.english === extension.replace(/_/g, " "));
      pageTitle = useHebrew ? category!.hebrew : category!.english;
    } else {
      back = routerTo("browse", container.indexCategory);
      const baseWidth = container.sections.some(x => x.length >= 5) ? 80 : 60;
      for (const [section, color] of withGradient(SECTIONS_COLOR, container.sections)) {
        const onClick = routerTo(extension, section);
        const width = section === `Introduction` ? `${baseWidth * 2 + 20}px` : `${baseWidth}px`;
        const key = section;
        const text = useHebrew && section === "Introduction" ? "הקדמה" : section;
        items.push(
          <ItemElement key={key} text={text} onClick={onClick} width={width} color={color} />,
        );
      }
      pageTitle = useHebrew ? container.hebrewName : container.canonicalName;
    }
  }

  return (
    <>
      <h1>{pageTitle}</h1>
      {back && <BackButton onClick={back} />}
      <div
        style={{display: "flex", flexWrap: "wrap", gap: "20px", justifyContent: "center"}}
        dir={useHebrew ? "rtl" : "ltr"}
        >
        {items}
      </div>
    </>
  );
}

function Main() {
  const rerender = useIncrementer()[1];
  return (
    <>
      <LanguageChooser rerender={rerender} padding="32px"><></></LanguageChooser>
      <Grid />
      <Preferences rerender={rerender} versions={[]} />
    </>
  );
}

function main() {
  const root = document.getElementById("main-contents");
  if (!root) {
    setTimeout(main, 10);
    return;
  }
  render(<Main />, root);
}

main();
