import * as React from "react";
import * as ReactDOM from "react-dom";
import {DocumentList} from "./DocumentList";
import {MikraotView} from "./MikraotView";
import {SiddurView} from "./SiddurView";

function App() {
  const path = window.location.pathname.replace(/\/$/, "");
  if (path.endsWith("/print/siddur")) return <SiddurView />;
  if (path.endsWith("/print/mikraot")) return <MikraotView />;
  return <DocumentList />;
}

ReactDOM.render(<App />, document.getElementById("print-app"));
