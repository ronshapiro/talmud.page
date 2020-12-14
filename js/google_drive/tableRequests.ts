// @ts-ignore
import {insertStyledText, StyledText} from "./insertTextRequests.ts";
// @ts-ignore
import {Color, Request} from "./types.ts";

interface Cell {
  cellText: (string | StyledText)[];
}

interface InsertTableParams {
  tableStart: number;
  backgroundColor: Color;
  borderColor: Color;
  borderWeight: number | undefined;
  cells: Cell[];
}

function insertTableStructureRequests(
  params: InsertTableParams,
): Request[] {
  const {tableStart, backgroundColor, borderColor} = params;
  const borderWeight = params.borderWeight || 1;
  const borderStyle = {
    color: borderColor,
    width: {
      magnitude: borderWeight,
      unit: "PT",
    },
    dashStyle: "SOLID",
  };
  return [
    {
      insertTable: {
        rows: params.cells.length,
        columns: 1,
        location: {index: tableStart},
      },
    }, {
      updateTableCellStyle: {
        // The `+ 1` was discovered through trial and error. It seems to work though...
        tableStartLocation: {index: tableStart + 1},
        fields: "*",
        tableCellStyle: {
          backgroundColor,
          borderLeft: borderStyle,
          borderRight: borderStyle,
          borderTop: borderStyle,
          borderBottom: borderStyle,
        },
      },
    },
  ];
}

function cellTextLength(cell: Cell): number {
  let length = 0;
  for (const part of cell.cellText) {
    if (typeof part === "string") {
      length += part.length;
    } else {
      length += part.text.length;
    }
  }
  return length;
}

export function insertTableRequests(
  params: InsertTableParams,
): Request[] {
  const requests = insertTableStructureRequests(params);
  // The + 1 accounts for the adjustment into the table from the start itself
  let cellTextIndex = params.tableStart + 1;
  for (const cell of params.cells) {
    // + 3 accounts for the following adjustments:
    // - Into the next row (+ 1)
    // - Into the row's column (+ 1)
    // - Into the cell for the column (+ 1)
    cellTextIndex += 3;
    requests.push(...insertStyledText(cell.cellText, cellTextIndex));
    cellTextIndex += cellTextLength(cell);
  }
  return requests;
}
