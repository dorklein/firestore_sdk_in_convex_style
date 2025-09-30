// Export validators
export { validators, type Validator, type DocumentId } from "./validators";
export * as v from "./validators";

// Export schema types and functions
export {
  defineSchema,
  defineTable,
  type Schema,
  type SchemaDefinition,
  type TableDefinition,
  type InferTableType,
  type Infer,
} from "./schema";

// Re-export ExtractDataModel as a type-only export
export type { ExtractDataModel } from "./schema";

// Export database types
export { Database, QueryBuilder, type DatabaseReader, type DatabaseWriter } from "./database";

// Export function builders
export {
  query,
  mutation,
  internalQuery,
  internalMutation,
  FunctionRunner,
  type QueryContext,
  type MutationContext,
  type QueryDefinition,
  type MutationDefinition,
} from "./functions";

// Export convenience types
export type { TableDocument, TableId } from "./types";
