// @ts-ignore
import {Color, Request} from "./types.ts";

interface InsertSingleCellTableRequestsParams {
  tableStart: number;
  backgroundColor: Color;
  borderColor: Color;
  borderWeight: number | undefined;
}

export function insertSingleCellTableRequests(
  params: InsertSingleCellTableRequestsParams,
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
        rows: 1,
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
