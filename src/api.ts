import { DefaultFunctionArgs, EmptyObject, FunctionVisibility } from "./registration";

/**
 * The type of a Convex function.
 *
 * @public
 */
export type FunctionType = "query" | "mutation" | "action";

export type FunctionReference<
  Type extends FunctionType,
  Visibility extends FunctionVisibility = "public",
  Args extends DefaultFunctionArgs = any,
  ReturnType = any,
  ComponentPath = string | undefined
> = {
  _type: Type;
  _visibility: Visibility;
  _args: Args;
  _returnType: ReturnType;
  _componentPath: ComponentPath;
};

/**
 * A {@link FunctionReference} of any type and any visibility with any
 * arguments and any return type.
 *
 * @public
 */
export type AnyFunctionReference = FunctionReference<any, any>;

/**
 * A tuple type of the (maybe optional) arguments to `FuncRef`.
 *
 * This type is used to make methods involving arguments type safe while allowing
 * skipping the arguments for functions that don't require arguments.
 *
 * @public
 */
export type OptionalRestArgs<FuncRef extends AnyFunctionReference> =
  FuncRef["_args"] extends EmptyObject ? [args?: EmptyObject] : [args: FuncRef["_args"]];

/**
 * Given a {@link FunctionReference}, get the return type of the function.
 *
 * @public
 */
export type FunctionReturnType<FuncRef extends AnyFunctionReference> = FuncRef["_returnType"];

type UndefinedToNull<T> = T extends void ? null : T;

type NullToUndefinedOrNull<T> = T extends null ? T | undefined | void : T;

/**
 * Convert the return type of a function to it's client-facing format.
 *
 * This means:
 * - Converting `undefined` and `void` to `null`
 * - Removing all `Promise` wrappers
 */
export type ConvertReturnType<T> = UndefinedToNull<Awaited<T>>;

export type ValidatorTypeToReturnType<T> =
  | Promise<NullToUndefinedOrNull<T>>
  | NullToUndefinedOrNull<T>;
