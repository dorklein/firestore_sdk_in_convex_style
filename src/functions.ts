import { Firestore } from "firebase-admin/firestore";
import { DatabaseImpl, TransactionalDatabaseImpl } from "./database.js";
import { SchemaDefinition } from "./schema.js";
import { GenericDataModel } from "./data_model.js";
import {
  GenericQueryCtx,
  GenericMutationCtx,
  RegisteredQuery,
  RegisteredMutation,
} from "./registration.js";
import { ObjectType, PropertyValidators } from "./values/index.js";

/**
 * Runtime executor for Convex-style functions.
 *
 * This class executes registered queries and mutations with proper type safety
 * and transaction handling.
 */
export class FunctionRunner<DataModel extends GenericDataModel> {
  private db: DatabaseImpl<DataModel>;

  constructor(firestore: Firestore, private schemaDefinition: SchemaDefinition<any, any>) {
    this.db = new DatabaseImpl(firestore, schemaDefinition);
  }

  /**
   * Execute a query function.
   *
   * @param query - The registered query function
   * @param args - The arguments to pass to the query
   * @returns The query result
   */
  async runQuery<Args extends Record<string, unknown>, Returns>(
    query: RegisteredQuery<any, Args, Returns>,
    args: Args
  ): Promise<Returns> {
    // Validate arguments if validator is provided
    const validatedArgs = query._argsValidator
      ? this.validateArgs(query._argsValidator, args)
      : args;

    // Create query context
    const ctx: GenericQueryCtx<DataModel> = {
      db: this.db,
      auth: undefined, // TODO: Implement auth
      storage: undefined, // TODO: Implement storage
      runQuery: async (nestedQuery, ...nestedArgs) => {
        return this.runQuery(nestedQuery as any, (nestedArgs[0] || {}) as any);
      },
    };

    // Execute the handler
    return await query._handler(ctx, validatedArgs as any);
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

    // Run mutation inside a Firestore transaction
    const firestore = this.db.getFirestore();
    return await firestore.runTransaction(async (transaction) => {
      // Create a transactional database wrapper
      const txDb = new TransactionalDatabaseImpl(firestore, this.schemaDefinition, transaction);

      // Create mutation context
      const ctx: GenericMutationCtx<DataModel> = {
        db: txDb as any, // Cast to work around generic constraints
        auth: undefined, // TODO: Implement auth
        storage: undefined, // TODO: Implement storage
        runQuery: async (nestedQuery, ...nestedArgs) => {
          // Queries within mutations use the transaction context
          const queryCtx: GenericQueryCtx<DataModel> = {
            db: txDb as any,
            auth: undefined,
            storage: undefined,
            runQuery: ctx.runQuery as any,
          };
          return await (nestedQuery as any)._handler(queryCtx, (nestedArgs[0] || {}) as any);
        },
        runMutation: async (nestedMutation, ...nestedArgs) => {
          // Nested mutations share the same transaction
          return await (nestedMutation as any)._handler(ctx, (nestedArgs[0] || {}) as any);
        },
      };

      // Execute the handler within the transaction
      // If the handler throws, the transaction will automatically roll back
      return await mutation._handler(ctx, validatedArgs as any);
    });
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

  /**
   * Get the underlying Firestore instance.
   */
  getFirestore(): Firestore {
    return this.db.getFirestore();
  }

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
export function createFunctionRunner<DataModel extends GenericDataModel>(
  firestore: Firestore,
  schemaDefinition: SchemaDefinition<any, any>
): FunctionRunner<DataModel> {
  return new FunctionRunner<DataModel>(firestore, schemaDefinition);
}
