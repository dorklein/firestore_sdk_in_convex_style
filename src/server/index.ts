/**
 * Utilities for implementing server-side Convex query and mutation functions.
 *
 * ## Usage
 *
 * ### Code Generation
 *
 * This module is typically used alongside generated server code.
 *
 * To generate the server code, run `npx convex dev` in your Convex project.
 * This will create a `convex/_generated/server.js` file with the following
 * functions, typed for your schema:
 * - [query](https://docs.convex.dev/generated-api/server#query)
 * - [mutation](https://docs.convex.dev/generated-api/server#mutation)
 *
 * If you aren't using TypeScript and code generation, you can use these untyped
 * functions instead:
 * - {@link queryGeneric}
 * - {@link mutationGeneric}
 *
 * ### Example
 *
 * Convex functions are defined by using either the `query` or
 * `mutation` wrappers.
 *
 * Queries receive a `db` that implements the {@link GenericDatabaseReader} interface.
 *
 * ```js
 * import { query } from "./_generated/server";
 *
 * export default query({
 *   handler: async ({ db }, { arg1, arg2 }) => {
 *     // Your (read-only) code here!
 *   },
 * });
 * ```
 *
 * If your function needs to write to the database, such as inserting, updating,
 * or deleting documents, use `mutation` instead which provides a `db` that
 * implements the {@link GenericDatabaseWriter} interface.
 *
 * ```js
 * import { mutation } from "./_generated/server";
 *
 * export default mutation({
 *   handler: async ({ db }, { arg1, arg2 }) => {
 *     // Your mutation code here!
 *   },
 * });
 * ```
 * @module
 */

export * from "./database.js";
export type {
  GenericDocument,
  GenericFieldPaths,
  GenericIndexFields,
  GenericTableIndexes,
  GenericSearchIndexConfig,
  GenericTableSearchIndexes,
  GenericVectorIndexConfig,
  GenericTableVectorIndexes,
  FieldTypeFromFieldPath,
  FieldTypeFromFieldPathInner,
  GenericTableInfo,
  DocumentByInfo,
  FieldPaths,
  GenericDataModel,
  AnyDataModel,
  TableNamesInDataModel,
  NamedTableInfo,
  DocumentByName,
} from "./data_model.js";

export {
  mutationGeneric,
  queryGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
} from "./impl/registration_impl.js";
export type {
  ArgsArray,
  DefaultFunctionArgs,
  FunctionVisibility,
  MutationBuilder,
  QueryBuilder,
  GenericMutationCtx,
  GenericQueryCtx,
  RegisteredMutation,
  RegisteredQuery,
  ReturnValueForOptionalValidator,
  ArgsArrayForOptionalValidator,
  ArgsArrayToObject,
  DefaultArgsForOptionalValidator,
} from "./registration.js";
export type {
  SystemFields,
  IdField,
  WithoutSystemFields,
  WithOptionalSystemFields,
  SystemIndexes,
  IndexTiebreakerField,
} from "./system_fields.js";
// export type { anyApi, getFunctionName, makeFunctionReference, filterApi } from "./api.ts";
export type {
  FunctionType,
  FunctionReference,
  FunctionArgs,
  OptionalRestArgs,
  FunctionReturnType,
} from "./api.ts";
/**
 * @internal
 */

/**
 * @internal
 */

export type {
  TableDefinition,
  SchemaDefinition,
  DefineSchemaOptions,
  GenericSchema,
  DataModelFromSchemaDefinition,
} from "./schema.ts";
export { defineTable, defineSchema } from "./schema.ts";

/**
 * @public
 */
export type { BetterOmit, Expand } from "../type_utils.js";
