import { FunctionReference, OptionalRestArgs, ValidatorTypeToReturnType } from "./api.js";
import { GenericDataModel } from "./data_model.js";
import { GenericDatabaseReader, GenericDatabaseWriter } from "./database.js";
import {
  GenericValidator,
  Infer,
  ObjectType,
  PropertyValidators,
  Validator,
} from "../values/index.js";

// Re-export PropertyValidators so it's available to importers
export type { PropertyValidators };

/**
 * The default arguments type for a Convex query, mutation, or action function.
 *
 * Convex functions always take an arguments object that maps the argument
 * names to their values.
 *
 * @public
 */
export type DefaultFunctionArgs = Record<string, unknown>;

/**
 * The arguments array for a function that takes arguments.
 *
 * This is an array of a single {@link DefaultFunctionArgs} element.
 */
type OneArgArray<ArgsObject extends DefaultFunctionArgs = DefaultFunctionArgs> = [ArgsObject];

/**
 * The arguments to a function that takes no arguments (just an empty array).
 */
type NoArgsArray = [];

/**
 * An array of arguments to a Convex function.
 *
 * Convex functions can take either a single {@link DefaultFunctionArgs} object or no
 * args at all.
 *
 * @public
 */
export type ArgsArray = OneArgArray | NoArgsArray;

/**
 * A type for the empty object `{}`.
 *
 * Note that we don't use `type EmptyObject = {}` because that matches every object.
 */
export type EmptyObject = Record<string, never>;

/**
 * Convert an {@link ArgsArray} into a single object type.
 *
 * Empty arguments arrays are converted to {@link EmptyObject}.
 * @public
 */
export type ArgsArrayToObject<Args extends ArgsArray> =
  Args extends OneArgArray<infer ArgsObject> ? ArgsObject : EmptyObject;

export type FunctionVisibility = "public" | "internal";

/**
 * Given a {@link FunctionVisibility}, should this function have `isPublic: true`
 * or `isInternal: true`?
 */
type VisibilityProperties<Visiblity extends FunctionVisibility> = Visiblity extends "public"
  ? {
      isPublic: true;
    }
  : {
      isInternal: true;
    };

/**
 * A set of services for use within Convex query functions.
 *
 * The query context is passed as the first argument to any Convex query
 * function run on the server.
 *
 * This differs from the {@link GenericMutationCtx} because all of the services are
 * read-only.
 *
 *
 * @public
 */
export interface GenericQueryCtx<DataModel extends GenericDataModel> {
  /**
   * A utility for reading data in the database.
   */
  db: GenericDatabaseReader<DataModel>;

  // /**
  //  * Information about the currently authenticated user.
  //  */
  // auth: unknown;

  // /**
  //  * A utility for reading files in storage.
  //  */
  // storage: unknown;

  /**
   * Call a query function within the same transaction.
   *
   * NOTE: often you can call the query's function directly instead of using this.
   * `runQuery` incurs overhead of running argument and return value validation,
   * and creating a new isolated JS context.
   */
  runQuery: <
    Query extends FunctionReference<"query", "public" | "internal">,
    // | RegisteredQuery<any, any, any>,
  >(
    query: Query,
    ...args: Query extends FunctionReference<any, any, any, any> ? OptionalRestArgs<Query> : any[]
  ) => Promise<Query extends FunctionReference<any, any, any, infer R> ? R : any>;
}

/**
 * A set of services for use within Convex mutation functions.
 *
 * The mutation context is passed as the first argument to any Convex mutation
 * function run on the server.
 *
 * @public
 */
export interface GenericMutationCtx<DataModel extends GenericDataModel> {
  /**
   * A utility for reading from and writing to the database within Convex mutation
   * functions.
   */
  db: GenericDatabaseWriter<DataModel>;

  // /**
  //  * Information about the currently authenticated user.
  //  */
  // auth: unknown;

  // /**
  //  * A utility for reading and writing files in storage.
  //  */
  // storage: unknown;

  /**
   * Call a query function within the same transaction.
   */
  runQuery: <
    Query extends FunctionReference<"query", "public" | "internal">,
    // | RegisteredQuery<any, any, any>,
  >(
    query: Query,
    ...args: Query extends FunctionReference<any, any, any, any> ? OptionalRestArgs<Query> : any[]
  ) => Promise<Query extends FunctionReference<any, any, any, infer R> ? R : any>;

  /**
   * Call a mutation function within the same transaction.
   */
  runMutation: <
    Mutation extends FunctionReference<"mutation", "public" | "internal">,
    // | RegisteredMutation<any, any, any>,
  >(
    mutation: Mutation,
    ...args: Mutation extends FunctionReference<any, any, any, any>
      ? OptionalRestArgs<Mutation>
      : any[]
  ) => Promise<Mutation extends FunctionReference<any, any, any, infer R> ? R : any>;
}

/**
 * A set of services for use within Convex action functions.
 *
 * The action context is passed as the first argument to any Convex action
 * function run on the server.
 *
 * Unlike queries and mutations, actions cannot directly access the database.
 * They must use `runQuery` and `runMutation` to interact with the database.
 *
 * @public
 */
// @ts-ignore - DataModel is used for type compatibility but not directly referenced
export interface GenericActionCtx<DataModel extends GenericDataModel> {
  // /**
  //  * Information about the currently authenticated user.
  //  */
  // auth: unknown;

  // /**
  //  * A utility for reading and writing files in storage.
  //  */
  // storage: unknown;

  /**
   * Call a query function.
   *
   * Actions cannot directly read from the database, so use this to run
   * queries to fetch data.
   */
  runQuery: <
    Query extends
      | FunctionReference<"query", "public" | "internal">
      | RegisteredQuery<any, any, any>,
  >(
    query: Query,
    ...args: Query extends FunctionReference<any, any, any, any> ? OptionalRestArgs<Query> : any[]
  ) => Promise<Query extends FunctionReference<any, any, any, infer R> ? R : any>;

  /**
   * Call a mutation function.
   *
   * Actions cannot directly write to the database, so use this to run
   * mutations to modify data.
   */
  runMutation: <
    Mutation extends
      | FunctionReference<"mutation", "public" | "internal">
      | RegisteredMutation<any, any, any>,
  >(
    mutation: Mutation,
    ...args: Mutation extends FunctionReference<any, any, any, any>
      ? OptionalRestArgs<Mutation>
      : any[]
  ) => Promise<Mutation extends FunctionReference<any, any, any, infer R> ? R : any>;

  /**
   * Call another action function.
   */
  runAction: <
    Action extends
      | FunctionReference<"action", "public" | "internal">
      | RegisteredAction<any, any, any>,
  >(
    action: Action,
    ...args: Action extends FunctionReference<any, any, any, any> ? OptionalRestArgs<Action> : any[]
  ) => Promise<Action extends FunctionReference<any, any, any, infer R> ? R : any>;
}

/**
 * There are multiple syntaxes for defining a Convex function:
 * ```
 *  - query(async (ctx, args) => {...})
 *  - query({ handler: async (ctx, args) => {...} })
 *  - query({ args: { a: v.string }, handler: async (ctx, args) => {...} } })
 *  - query({ args: { a: v.string }, returns: v.string(), handler: async (ctx, args) => {...} } })
 *```
 *
 * In each of these, we want to correctly infer the type for the arguments and
 * return value, preferring the type derived from a validator if it's provided.
 *
 * To avoid having a separate overload for each, which would show up in error messages,
 * we use the type params -- ArgsValidator, ReturnsValidator, ReturnValue, OneOrZeroArgs.
 *
 * The type for ReturnValue and OneOrZeroArgs are constrained by the type or ArgsValidator and
 * ReturnsValidator if they're present, and inferred from any explicit type annotations to the
 * arguments or return value of the function.
 *
 * Below are a few utility types to get the appropriate type constraints based on
 * an optional validator.
 *
 * Additional tricks:
 * - We use Validator | void instead of Validator | undefined because the latter does
 * not work with `strictNullChecks` since it's equivalent to just `Validator`.
 * - We use a tuple type of length 1 to avoid distribution over the union
 *  https://github.com/microsoft/TypeScript/issues/29368#issuecomment-453529532
 */

export type ReturnValueForOptionalValidator<
  ReturnsValidator extends Validator<any, any, any> | PropertyValidators | void,
> = [ReturnsValidator] extends [Validator<any, any, any>]
  ? ValidatorTypeToReturnType<Infer<ReturnsValidator>>
  : [ReturnsValidator] extends [PropertyValidators]
    ? ValidatorTypeToReturnType<ObjectType<ReturnsValidator>>
    : any;

export type ArgsArrayForOptionalValidator<
  ArgsValidator extends GenericValidator | PropertyValidators | void,
> = [ArgsValidator] extends [Validator<any, any, any>]
  ? OneArgArray<Infer<ArgsValidator>>
  : [ArgsValidator] extends [PropertyValidators]
    ? OneArgArray<ObjectType<ArgsValidator>>
    : ArgsArray;

export type DefaultArgsForOptionalValidator<
  ArgsValidator extends GenericValidator | PropertyValidators | void,
> = [ArgsValidator] extends [Validator<any, any, any>]
  ? [Infer<ArgsValidator>]
  : [ArgsValidator] extends [PropertyValidators]
    ? [ObjectType<ArgsValidator>]
    : OneArgArray;

/**
 * A query function that is part of this app.
 *
 * You can create a query by wrapping your function in
 * {@link queryGeneric} or {@link internalQueryGeneric} and exporting it.
 *
 * @public
 */
export type RegisteredQuery<
  Visibility extends FunctionVisibility,
  Args extends DefaultFunctionArgs,
  Returns,
> = {
  isConvexFunction: true;
  isQuery: true;

  /** @internal */
  invokeQuery(argsStr: string): Promise<string>;

  /** @internal */
  exportArgs(): string;

  /** @internal */
  exportReturns(): string;

  /** @internal */
  _argsValidator?: PropertyValidators;

  /** @internal */
  _returnsValidator?: Validator<any, any, any>;

  /** @internal */
  _handler: (ctx: GenericQueryCtx<any>, args: Args) => Returns;
} & VisibilityProperties<Visibility>;

export function isRegisteredQuery(func: any): func is RegisteredQuery<any, any, any> {
  return func.isConvexFunction && func.isQuery;
}

/**
 * A mutation function that is part of this app.
 *
 * You can create a mutation by wrapping your function in
 * {@link mutationGeneric} or {@link internalMutationGeneric} and exporting it.
 *
 * @public
 */
export type RegisteredMutation<
  Visibility extends FunctionVisibility,
  Args extends DefaultFunctionArgs,
  Returns,
> = {
  isConvexFunction: true;
  isMutation: true;

  /** @internal */
  invokeMutation(argsStr: string): Promise<string>;

  /** @internal */
  exportArgs(): string;

  /** @internal */
  exportReturns(): string;

  /** @internal */
  _argsValidator?: PropertyValidators;

  /** @internal */
  _returnsValidator?: Validator<any, any, any>;

  /** @internal */
  _handler: (ctx: GenericMutationCtx<any>, args: Args) => Returns;
} & VisibilityProperties<Visibility>;

export function isRegisteredMutation(func: any): func is RegisteredMutation<any, any, any> {
  return func.isConvexFunction && func.isMutation;
}

/**
 * An action function that is part of this app.
 *
 * You can create an action by wrapping your function in
 * {@link actionGeneric} or {@link internalActionGeneric} and exporting it.
 *
 * @public
 */
export type RegisteredAction<
  Visibility extends FunctionVisibility,
  Args extends DefaultFunctionArgs,
  Returns,
> = {
  isConvexFunction: true;
  isAction: true;

  /** @internal */
  invokeAction(argsStr: string): Promise<string>;

  /** @internal */
  exportArgs(): string;

  /** @internal */
  exportReturns(): string;

  /** @internal */
  _argsValidator?: PropertyValidators;

  /** @internal */
  _returnsValidator?: Validator<any, any, any>;

  /** @internal */
  _handler: (ctx: GenericActionCtx<any>, args: Args) => Returns;
} & VisibilityProperties<Visibility>;

export function isRegisteredAction(func: any): func is RegisteredAction<any, any, any> {
  return func.isConvexFunction && func.isAction;
}

export type QueryBuilder<
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
> = {
  <
    ArgsValidator extends PropertyValidators | Validator<any, "required", any> | void = void,
    ReturnsValidator extends PropertyValidators | Validator<any, "required", any> | void = void,
    ReturnValue extends
      ReturnValueForOptionalValidator<ReturnsValidator> = ReturnValueForOptionalValidator<ReturnsValidator>,
    OneOrZeroArgs extends
      ArgsArrayForOptionalValidator<ArgsValidator> = DefaultArgsForOptionalValidator<ArgsValidator>,
  >(
    query:
      | {
          /**
           * Argument validation.
           *
           * Examples:
           *
           * ```
           * args: {}
           * args: { input: v.optional(v.number()) }
           * args: { message: v.string(), author: v.id("authors") }
           * args: { messages: v.array(v.string()) }
           * ```
           */
          args?: ArgsValidator;
          /**
           * The return value validator.
           *
           * Examples:
           *
           * ```
           * returns: v.null()
           * returns: v.string()
           * returns: { message: v.string(), author: v.id("authors") }
           * returns: v.array(v.string())
           * ```
           */
          returns?: ReturnsValidator;
          /**
           * The implementation of this function.
           *
           * This is a function that takes in the appropriate context and arguments
           * and produces some result.
           *
           * @param ctx - The context object. This is one of {@link GenericQueryCtx},
           * {@link GenericMutationCtx}, or {@link ActionCtx} depending on the function type.
           * @param args - The arguments object for this function. This will match
           * the type defined by the argument validator if provided.
           * @returns
           */
          handler: (ctx: GenericQueryCtx<DataModel>, ...args: OneOrZeroArgs) => ReturnValue;
        }
      | ((ctx: GenericQueryCtx<DataModel>, ...args: OneOrZeroArgs) => ReturnValue)
  ): RegisteredQuery<Visibility, ArgsArrayToObject<OneOrZeroArgs>, ReturnValue>;
};

export type MutationBuilder<
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
> = {
  <
    ArgsValidator extends PropertyValidators | Validator<any, "required", any> | void = void,
    ReturnsValidator extends PropertyValidators | Validator<any, "required", any> | void = void,
    ReturnValue extends
      ReturnValueForOptionalValidator<ReturnsValidator> = ReturnValueForOptionalValidator<ReturnsValidator>,
    OneOrZeroArgs extends
      ArgsArrayForOptionalValidator<ArgsValidator> = DefaultArgsForOptionalValidator<ArgsValidator>,
  >(
    mutation:
      | {
          /**
           * Argument validation.
           */
          args?: ArgsValidator;
          /**
           * The return value validator.
           */
          returns?: ReturnsValidator;
          /**
           * The implementation of this function.
           */
          handler: (ctx: GenericMutationCtx<DataModel>, ...args: OneOrZeroArgs) => ReturnValue;
        }
      | ((ctx: GenericMutationCtx<DataModel>, ...args: OneOrZeroArgs) => ReturnValue)
  ): RegisteredMutation<Visibility, ArgsArrayToObject<OneOrZeroArgs>, ReturnValue>;
};

export type ActionBuilder<
  DataModel extends GenericDataModel,
  Visibility extends FunctionVisibility,
> = {
  <
    ArgsValidator extends PropertyValidators | Validator<any, "required", any> | void = void,
    ReturnsValidator extends PropertyValidators | Validator<any, "required", any> | void = void,
    ReturnValue extends
      ReturnValueForOptionalValidator<ReturnsValidator> = ReturnValueForOptionalValidator<ReturnsValidator>,
    OneOrZeroArgs extends
      ArgsArrayForOptionalValidator<ArgsValidator> = DefaultArgsForOptionalValidator<ArgsValidator>,
  >(
    action:
      | {
          /**
           * Argument validation.
           */
          args?: ArgsValidator;
          /**
           * The return value validator.
           */
          returns?: ReturnsValidator;
          /**
           * The implementation of this function.
           */
          handler: (ctx: GenericActionCtx<DataModel>, ...args: OneOrZeroArgs) => ReturnValue;
        }
      | ((ctx: GenericActionCtx<DataModel>, ...args: OneOrZeroArgs) => ReturnValue)
  ): RegisteredAction<Visibility, ArgsArrayToObject<OneOrZeroArgs>, ReturnValue>;
};

// Export helper type for query builder instance
export type QueryBuilderInstance<DataModel extends GenericDataModel> = QueryBuilder<
  DataModel,
  "internal"
>;
