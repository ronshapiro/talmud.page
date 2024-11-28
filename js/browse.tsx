import * as React from "react";
import {render} from 'react-dom';
import {zip} from "underscore";
import {Book, Category, browseIndex} from "./BrowseIndex";
import {useIncrementer} from "./hooks";

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
  return (
    <button
      style={{
        position: "fixed",
        top: "20px",
        left: "20px",
        padding: "30px",
      }}
      className="mdl-button mdl-js-button mdl-button--icon mdl-js-ripple-effect"
      onClick={onClick}>
      <i className="material-icons">arrow_back</i>
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
      const onClick = routerTo("browse", category);
      items.push(<ItemElement key={category} text={category} onClick={onClick} color={color} />);
    }
    pageTitle = "Browse";
  } else {
    const container = browseIndex.index[extension];
    if (!container) {
      back = routerTo("browse");
      pageTitle = <span style={{color: "red"}}>No title or category: &quot;{extension}&quot;</span>;
    } else if (isCategory(container)) {
      back = routerTo("browse");
      for (const [title, color] of withGradient(BLUE, container.contents)) {
        const book = browseIndex.index[title] as Book;
        const text = <>{book.indexSubcategoryTitle}<br />{book.indexSubcategoryHebrewTitle}</>;
        const onClick = extension === "Prayer"
          ? routerTo(title)
          : routerTo("browse", title);
        items.push(<ItemElement key={title} text={text} onClick={onClick} color={color} />);
      }
    } else {
      back = routerTo("browse", container.indexCategory);
      for (const [section, color] of withGradient(SECTIONS_COLOR, container.sections)) {
        const onClick = routerTo(extension, section);
        items.push(
          <ItemElement key={section} text={section} onClick={onClick} width="60px" color={color} />,
        );
      }
    }
  }

  return (
    <>
      <h1>{pageTitle}</h1>
      {back && <BackButton onClick={back} />}
      <div style={{display: "flex", flexWrap: "wrap", gap: "20px", justifyContent: "center"}}>
        {items}
      </div>
    </>
  );
}


function main() {
  const root = document.getElementById("main-contents");
  if (!root) {
    setTimeout(main, 10);
    return;
  }

  render(<Grid />, root);
}

main();
