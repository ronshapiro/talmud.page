// @ts-ignore
import {NullaryFunction} from "./types.ts";

export interface NavigationExtension {
  previous: NullaryFunction<string>;
  next: NullaryFunction<string>;

  hasPrevious: NullaryFunction<boolean>;
  hasNext: NullaryFunction<boolean>;

  loadPrevious: NullaryFunction<void>;
  loadNext: NullaryFunction<void>;

  defaultEditText: NullaryFunction<string>;
}
