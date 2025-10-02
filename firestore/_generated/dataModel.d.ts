/* eslint-disable */
/**
 * Generated data model types.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx @smartbill/firestore-convex-style dev`.
 * @module
 */

import { AnyDataModel } from "@smartbill/firestore-convex-style/server";
import type { GenericId } from "@smartbill/firestore-convex-style/values";

/**
 * No `schema.ts` file found!
 *
 * This generated code has permissive types like `Doc = any` because
 * We doesn't know your schema. If you'd like more type safety, see
 * .... todo(docs url) for instructions on how to add a
 * schema file.
 *
 * After you change a schema, rerun codegen with `npx @smartbill/firestore-convex-style dev`.
 */

/**
 * The names of all of your Firestore tables.
 */
export type TableNames = string;

/**
 * The type of a document stored in Firestore.
 */
export type Doc = any;

/**
 * An identifier for a document in Firestore.
 *
 * Firestore documents are uniquely identified by their `Id`, which is accessible
 * on the `_id` field. To learn more, see [Document IDs](https://firebase.google.com/docs/firestore/manage-data/add-data#document_ids).
 *
 * Documents can be loaded using `db.get(id)` in query and mutation functions.
 *
 * IDs are just strings at runtime, but this type can be used to distinguish them from other
 * strings when type checking.
 */
export type Id<TableName extends TableNames = TableNames> =
  GenericId<TableName>;

/**
 * A type describing your Firestore data model.
 *
 * This type includes information about what tables you have, the type of
 * documents stored in those tables, and the indexes defined on them.
 *
 * This type is used to parameterize methods like `queryGeneric` and
 * `mutationGeneric` to make them type-safe.
 */
export type DataModel = AnyDataModel;
