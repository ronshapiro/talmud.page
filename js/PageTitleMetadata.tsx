import * as React from "react";
import {Section as Segment} from "../apiTypes";
import {enumerate} from "../util/enumerate";

export function PageTitleMetadata({
  segments,
}: {
  segments: Segment[]
}): React.ReactElement {
  let currentSugya = 0;
  const counts: (number | string)[] = [];
  for (const [segment, i] of enumerate(segments)) {
    if (segment.hadran) {
      counts.push(`${currentSugya} + הדרן`);
      currentSugya = 0;
      continue;
    }
    if (segment.steinsaltz_start_of_sugya && i !== 0 && currentSugya !== 0) {
      counts.push(currentSugya);
      currentSugya = 0;
    }
    currentSugya++;
  }
  if (currentSugya !== 0) {
    counts.push(currentSugya);
  }
  return <span className="segmentCount">({counts.join(", ")})</span>;
}
