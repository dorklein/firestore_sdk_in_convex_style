/**
 * Convenience type exports for end users
 */

import type { ExtractDataModel, SchemaDefinition, Infer } from "./schema";
import type { QueryContext, MutationContext } from "./functions";
import type { DocumentId, Validator } from "./validators";

// Re-export commonly used types
export type {
  ExtractDataModel,
  SchemaDefinition,
  Infer,
  QueryContext,
  MutationContext,
  DocumentId,
  Validator,
};

// Helper type to get the document type from a table in a schema
export type TableDocument<
  S extends SchemaDefinition,
  TableName extends keyof ExtractDataModel<S>
> = ExtractDataModel<S>[TableName];

// Helper type to get a document ID for a table
export type TableId<TableName extends string> = DocumentId<TableName>;

