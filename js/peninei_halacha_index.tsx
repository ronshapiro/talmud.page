import * as React from "react";
// import {SyntheticEvent} from "react"; // do not submit
import {createRoot} from "react-dom/client";
import {$} from "./jquery";

const {useState} = React;

async function process(x: any, topLevels: any[]) {
  for (const next of x.contents || []) {
    // Make the requests serially - this is a lazy way to maintain order.
    // eslint-disable-next-line no-await-in-loop
    await process(next, topLevels);
  }
  if (x.title && x.title.startsWith("Peninei Halakhah")) {
    const subindex = await fetch(`https://www.sefaria.org/api/index/${x.title}`);
    const json = await subindex.json();
    topLevels.push(json);
  }
}

async function processAll(json: any[]): Promise<any[]> {
  const topLevels: any[] = [];
  for (const x of json) {
    // Make the requests serially - this is a lazy way to maintain order.
    // eslint-disable-next-line no-await-in-loop
    await process(x, topLevels);
  }
  return topLevels;
}

function Container({data, depth}: {
  data: any,
  depth: number
}) {
  const [isExpanded, setExpanded] = useState(false);
  const onClick = () => setExpanded(!isExpanded);
  /*
  const onKeyPress = (e: SyntheticEvent) => {
    if (e.code === "Enter") onClick();
  };
  */
  const children = data?.alts?.Topic?.nodes || data.nodes;
  let prefix = "";
  for (let i = 0; i < depth; i++) {
    prefix += "--";
  }
  if (children) {
    return (
      <div>
        <a
          onClick={onClick}
          href="#"
          role="button"
        >
          {prefix} {data.title}
        </a>
        {isExpanded && children.map(
          (child: any) => <Container depth={depth + 1} data={child} key={child.title} />)}
      </div>
    );
  }
  const url = `/ph/${data.wholeRef.replace(/ /g, "_")}`;
  return <p>{prefix} <a href={url}>{data.title}</a></p>;
}

function Index({json}: any) {
  return (
    <div>
      {json.map((x: any) => <Container key={x.title} data={x} depth={0} />)}
    </div>);
}

function start(topLevels: any[]) {
  createRoot(document.querySelector("#main")!).render(<Index json={topLevels} />);
}

const KEY = "peninei_halacha_index";

window.addEventListener("load", () => {
  if (localStorage[KEY]) {
    start(JSON.parse(localStorage[KEY]));
  } else {
    $.ajax({
      url: "https://sefaria.org/api/index",
      type: "GET",
      success: (results: any) => {
        processAll(results).then(topLevels => {
          localStorage[KEY] = JSON.stringify(topLevels);
          start(topLevels);
        });
      },
    });
  }
});
