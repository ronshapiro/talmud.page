import {NullaryFunction} from "./types";

export interface BaseNavigationExtension {
  previous: NullaryFunction<string>;
  next: NullaryFunction<string>;

  hasPrevious: NullaryFunction<boolean>;
  hasNext: NullaryFunction<boolean>;
}

export interface NavigationExtension extends BaseNavigationExtension {
  loadPrevious: NullaryFunction<void>;
  loadNext: NullaryFunction<void>;

  defaultEditText: NullaryFunction<string>;
}
