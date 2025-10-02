// Export validators
export * from "./values/index.js";

// Export registration types for query/mutation builders
export type {
  GenericQueryCtx,
  GenericMutationCtx,
  QueryBuilder,
  MutationBuilder,
  RegisteredQuery,
  RegisteredMutation,
} from "./server/registration.ts";

// Export schema types and functions
export {
  defineSchema,
  defineTable,
  type SchemaDefinition,
  type TableDefinition,
  type GenericSchema,
  type DataModelFromSchemaDefinition,
} from "./server/schema.js";

// Export database types
export {
  DatabaseImpl,
  TransactionalDatabaseImpl,
  QueryBuilder as DBQueryBuilder,
  type DatabaseReader,
  type DatabaseWriter,
  type GenericDatabaseReader,
  type GenericDatabaseWriter,
} from "./server/database.js";

// Export data model types
export type {
  DocumentByName,
  TableNamesInDataModel,
  GenericDataModel,
  GenericTableInfo,
  NamedTableInfo,
  GenericDocument,
} from "./server/data_model.js";

// Export system fields types
export type {
  SystemFields,
  IdField,
  WithoutSystemFields,
  WithOptionalSystemFields,
} from "./server/system_fields.js";

// Export type utils
export type { Expand, BetterOmit } from "./type_utils.js";

// Export API types
export type {
  FunctionType,
  FunctionReference,
  AnyFunctionReference,
  OptionalRestArgs,
  FunctionReturnType,
  FunctionArgs,
  FunctionReturn,
} from "./server/api.js";

// Export function runner
export { FunctionRunner, createFunctionRunner } from "./server/functions.js";
export * from "./server/index.js";
