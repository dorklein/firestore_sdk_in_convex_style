import {
  DefaultFunctionArgs,
  EmptyObject,
  FunctionVisibility,
  RegisteredQuery,
  RegisteredMutation,
  RegisteredAction,
} from "./registration.js";

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
  ComponentPath = string | undefined,
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

/**
 * Extract the arguments type from a RegisteredQuery, RegisteredMutation, or RegisteredAction.
 *
 * @example
 * ```typescript
 * const getUserById = internalQuery({
 *   args: { userId: v.id("users") },
 *   handler: async (ctx, args) => { ... }
 * });
 *
 * type Args = FunctionArgs<typeof getUserById>;
 * // Args is { userId: Id<"users"> }
 * ```
 *
 * @public
 */
export type FunctionArgs<T> =
  T extends RegisteredQuery<any, infer Args, any>
    ? Args
    : T extends RegisteredMutation<any, infer Args, any>
      ? Args
      : T extends RegisteredAction<any, infer Args, any>
        ? Args
        : never;

/**
 * Extract the return type from a RegisteredQuery, RegisteredMutation, or RegisteredAction.
 *
 * @example
 * ```typescript
 * const getUserById = internalQuery({
 *   args: { userId: v.id("users") },
 *   handler: async (ctx, args) => {
 *     return await ctx.db.get(args.userId);
 *   }
 * });
 *
 * type ReturnType = FunctionReturn<typeof getUserById>;
 * // ReturnType is Promise<Doc<"users"> | null>
 * ```
 *
 * @public
 */
export type FunctionReturn<T> =
  T extends RegisteredQuery<any, any, infer Returns>
    ? Returns
    : T extends RegisteredMutation<any, any, infer Returns>
      ? Returns
      : T extends RegisteredAction<any, any, infer Returns>
        ? Returns
        : never;
