import * as Mousetrap from "mousetrap";
import {$} from "./jquery";

interface Box {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  temp: boolean;
  labelType: string;
}

function getCanvas(): HTMLCanvasElement {
  return (document.getElementById("dafCanvas") as HTMLCanvasElement)!;
}

function getImage(): HTMLImageElement {
  return (document.getElementById("daf") as HTMLImageElement)!;
}

const LABEL_TYPES: Record<string, string> = {
  Gemara: "rgba(80, 80, 80, .3)",
  Rashi: "rgba(100, 200, 100, .5)",
  Tosafot: "rgba(200, 100, 200, .5)",
  "Ein Mishpat": "rgba(100, 100, 250, .5)",
  "Mesorat Hashas": "rgba(250, 250, 50, .5)",
  Bach: "rgba(255, 150, 50, .5)",
  "Gilyon Hashas": "rgba(50, 200, 255, .5)",
  Gra: "rgba(200, 100, 100, .5)",
  Footnotes: "rgba(0, 0, 0, .4)",
};
let labelTypeIndex = 0;

function updateLabelType() {
  document.getElementById("labelType")!.textContent = Object.keys(LABEL_TYPES)[labelTypeIndex];
}

Mousetrap.bind(["d", "j"], () => {
  labelTypeIndex++;
  if (labelTypeIndex === Object.keys(LABEL_TYPES).length) labelTypeIndex = 0;
  updateLabelType();
});

Mousetrap.bind(["s", "k"], () => {
  labelTypeIndex--;
  if (labelTypeIndex < 0) labelTypeIndex = Object.keys(LABEL_TYPES).length - 1;
  updateLabelType();
});

const main = () => {
  const canvas = getCanvas();
  const context = canvas.getContext("2d")!;

  context.lineWidth = 4;
  const boxes: Box[] = [];

  /*
  for (let i = 0; i < Object.keys(LABEL_TYPES).length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const LEN = 125;
    const x = 10 * (col + 1) + col * LEN;
    const y = 10 * (row + 1) + row * LEN;
    boxes.push({
      startX: x,
      startY: y,
      endX: x + LEN,
      endY: y + LEN,
      temp: false,
      labelType: Object.keys(LABEL_TYPES)[i],
    });
  }
  */

  const redraw = () => {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const box of boxes) {
      context.fillStyle = LABEL_TYPES[box.labelType];
      context.fillRect(box.startX, box.startY,
                       box.endX! - box.startX,
                       box.endY! - box.startY);
    }
  };

  redraw();

  Mousetrap.bind(["z", "ctrl-z", "command+z"], () => {
    boxes.pop();
    redraw();
  });

  const setLastEnd = (event: JQuery.Event, temp: boolean) => {
    Object.assign(boxes.slice(-1)[0], {
      endX: event.offsetX!,
      endY: event.offsetY!,
      temp,
    });
  };

  $("#dafCanvas").on("mousemove", (event: JQuery.Event) => {
    if (boxes.length > 0 && boxes.slice(-1)[0].temp) {
      setLastEnd(event, true);
      redraw();
    }
  });

  /*
  $("#dafCanvas").on("mousedown", (event: JQuery.Event) => {
    console.log("mousedown", event);
  });

  $("#dafCanvas").on("dragstart", (event: JQuery.Event) => {
    console.log("dragstart", event);
  });

  $("#dafCanvas").on("dragend", (event: JQuery.Event) => {
    console.log("dragend", event);
  });
  */

  $("#dafCanvas").on("click", (event: JQuery.Event) => {
    const newBox = boxes.length === 0 || !boxes.slice(-1)[0].temp;
    if (newBox) {
      boxes.push({
        startX: event.offsetX!,
        startY: event.offsetY!,
        endX: event.offsetX!,
        endY: event.offsetY!,
        temp: true,
        labelType: Object.keys(LABEL_TYPES)[labelTypeIndex],
      });
    } else {
      setLastEnd(event, false);
      redraw();
    }
  });
};

function writeColorCode() {
  const lines = ["<br>"];
  for (const [labelType, color] of Object.entries(LABEL_TYPES)) {
    lines.push(`
      <div style="padding:0px 0px 4px 0px">
        <span style="background: ${color}; display:inline-block; width: 40px;">&nbsp;</span>
        <span>&nbsp;</span>
        ${labelType}
      </div>
    `);
  }
  document.getElementById("colorCode")!.innerHTML = lines.join("");
}

window.addEventListener("load", () => {
  updateLabelType();
  writeColorCode();

  const canvas = getCanvas();
  const image = getImage();
  canvas.width = image.width;
  canvas.height = image.height;

  image.addEventListener("load", main, false);
  if (image.complete) {
    main();
  }
});
