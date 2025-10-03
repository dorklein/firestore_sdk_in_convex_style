import { SchemaDefinition } from "./schema.js";
import { RegisteredQuery, RegisteredMutation, RegisteredAction } from "./registration.js";
import { ObjectType, PropertyValidators, Value } from "../values/index.js";

/**
 * Runtime executor for Convex-style functions.
 *
 * This class executes registered queries and mutations with proper type safety
 * and transaction handling.
 */
export class FunctionRunner {
  constructor(private schemaDefinition: SchemaDefinition<any, any>) {}

  /**
   * Execute a query function.
   *
   * @param query - The registered query function
   * @param args - The arguments to pass to the query
   * @returns The query result
   */
  async runQuery<Args extends Record<string, Value>, Returns>(
    query: RegisteredQuery<any, Args, Returns>,
    args: Args
  ): Promise<Returns> {
    // Validate arguments if validator is provided
    const validatedArgs = query._argsValidator
      ? this.validateArgs(query._argsValidator, args)
      : args;

    const result = await query.invokeQuery(validatedArgs as Args);
    return result;
  }

  /**
   * Execute a mutation function.
   *
   * Mutations automatically run inside a Firestore transaction for atomicity.
   * If the mutation throws an error, the transaction will be rolled back.
   *
   * @param mutation - The registered mutation function
   * @param args - The arguments to pass to the mutation
   * @returns The mutation result
   */
  async runMutation<Args extends Record<string, unknown>, Returns>(
    mutation: RegisteredMutation<any, Args, Returns>,
    args: Args
  ): Promise<Returns> {
    // Validate arguments if validator is provided
    const validatedArgs = mutation._argsValidator
      ? this.validateArgs(mutation._argsValidator, args)
      : args;
    const result = await mutation.invokeMutation(validatedArgs as Args);
    return result;
  }

  /**
   * Execute an action function.
   *
   * Actions are for side effects and cannot directly access the database.
   * They must use ctx.runQuery and ctx.runMutation to interact with data.
   *
   * @param action - The registered action function
   * @param args - The arguments to pass to the action
   * @returns The action result
   */
  async runAction<Args extends Record<string, unknown>, Returns>(
    action: RegisteredAction<any, Args, Returns>,
    args: Args
  ): Promise<Returns> {
    // Validate arguments if validator is provided
    const validatedArgs = action._argsValidator
      ? this.validateArgs(action._argsValidator, args)
      : args;

    const result = await action.invokeAction(validatedArgs as Args);
    return result;
  }

  /**
   * Validate arguments against a validator schema.
   *
   * @internal
   */
  private validateArgs<V extends PropertyValidators>(
    _argsValidator: V,
    rawArgs: unknown
  ): ObjectType<V> {
    // For now, just return the args as-is since we're using TypeScript for validation
    // In the future, we could add runtime validation using the validator.json
    // TODO: Implement runtime validation using valibot based on validator.json

    return rawArgs as ObjectType<V>;
  }

  // /**
  //  * Get the underlying Firestore instance.
  //  */
  // getFirestore(): Firestore {
  //   return this.db.getFirestore();
  // }

  /**
   * Get the schema definition.
   */
  getSchema(): SchemaDefinition<any, any> {
    return this.schemaDefinition;
  }
}

/**
 * Create a function runner from a Firestore instance and schema.
 *
 * @example
 * ```typescript
 * import admin from "firebase-admin";
 * import { schema } from "./schema.js";
 * import { createFunctionRunner } from "./functions.js";
 *
 * admin.initializeApp();
 * const firestore = admin.firestore();
 *
 * const runner = createFunctionRunner(firestore, schema);
 *
 * // Run a query
 * const user = await runner.runQuery(getUserById, { userId: "users|123" });
 *
 * // Run a mutation
 * const newUserId = await runner.runMutation(createUser, {
 *   name: "Alice",
 *   email: "alice@example.com"
 * });
 * ```
 */
export function createFunctionRunner(schemaDefinition: SchemaDefinition<any, any>): FunctionRunner {
  return new FunctionRunner(schemaDefinition);
}
