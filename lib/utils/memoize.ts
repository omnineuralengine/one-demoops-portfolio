type AnyFunction = (...args: never[]) => unknown;

/**
 * A dependency-free, one-entry memoizer for selectors. It preserves referential
 * equality when a reducer returns the same inputs and never mutates arguments.
 */
export function memoizeLast<TFunction extends AnyFunction>(
  fn: TFunction,
): TFunction {
  let hasValue = false;
  let previousArgs: readonly unknown[] = [];
  let previousResult: ReturnType<TFunction>;

  return function memoized(
    this: unknown,
    ...args: Parameters<TFunction>
  ): ReturnType<TFunction> {
    const unchanged =
      hasValue &&
      args.length === previousArgs.length &&
      args.every((argument, index) => Object.is(argument, previousArgs[index]));

    if (!unchanged) {
      previousResult = fn.apply(this, args) as ReturnType<TFunction>;
      previousArgs = args;
      hasValue = true;
    }

    return previousResult;
  } as TFunction;
}
