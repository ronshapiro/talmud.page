export interface NullaryFunction<T> {
  (): T;
}

export interface UnaryFunction<I, O> {
  (_i: I): O;
}

export interface BinaryFunction<I1, I2, O> {
  (_i1: I1, _i2: I2): O;
}
