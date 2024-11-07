import * as React from "react";
import {Section as Segment} from "../apiTypes";

export function PageTitleMetadata({
  segments,
}: {
  segments: Segment[]
}): React.ReactElement {
  let currentSugya = 0;
  const counts: number[] = [];
  segments.forEach((segment, i) => {
    if (segment.steinsaltz_start_of_sugya && i !== 0) {
      counts.push(currentSugya);
      currentSugya = 0;
    }
    currentSugya++;
  });
  counts.push(currentSugya);
  return <span className="segmentCount">({counts.join(", ")})</span>;
}
