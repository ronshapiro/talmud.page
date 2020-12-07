export interface NullaryFunction<T> {
  (): T;
}

export interface UnaryFunction<I, O> {
  (_i: I): O;
}
