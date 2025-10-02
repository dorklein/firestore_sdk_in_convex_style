/**
 * The type of JavaScript values serializable to JSON.
 *
 * @public
 */
export type JSONValue =
  | null
  | boolean
  | number
  | string
  | JSONValue[]
  | { [key: string]: JSONValue };

/**
 * An identifier for a document in Convex.
 *
 * Convex documents are uniquely identified by their `Id`, which is accessible
 * on the `_id` field. To learn more, see [Document IDs](https://docs.convex.dev/database/document-ids).
 *
 * Documents can be loaded using `db.get(id)` in query and mutation functions.
 *
 * IDs are base 32 encoded strings which are URL safe.
 *
 * IDs are just strings at runtime, but this type can be used to distinguish them from other
 * strings at compile time.
 *
 * If you're using code generation, use the `Id` type generated for your data model in
 * `convex/_generated/dataModel.d.ts`.
 *
 * @typeParam TableName - A string literal type of the table name (like "users").
 *
 * @public
 */
export type Id<TableName extends string> = string & { __tableName: TableName };

/**
 * A value supported by Convex.
 *
 * Values can be:
 * - stored inside of documents.
 * - used as arguments and return types to queries and mutation functions.
 *
 * You can see the full set of supported types at
 * [Types](https://docs.convex.dev/using/types).
 *
 * @public
 */
export type Value =
  | null
  | bigint
  | number
  | boolean
  | string
  | ArrayBuffer
  | Value[]
  | { [key: string]: undefined | Value };

/**
 * The types of {@link Value} that can be used to represent numbers.
 *
 * @public
 */
export type NumericValue = bigint | number;

// todo
export function convexToJson(value: any) {
  console.warn("[convexToJson] implement me");
  return JSON.stringify(value);
}

export function jsonToConvex(value: any) {
  console.warn("[jsonToConvex] implement me");
  return value;
  return JSON.parse(value);
}

export function stringifyValueForError(value: any) {
  return JSON.stringify(value, (_key, value) => {
    if (value === undefined) {
      // By default `JSON.stringify` converts undefined, functions, symbols,
      // Infinity, and NaN to null which produces a confusing error message.
      // We deal with `undefined` specifically because it's the most common.
      // Ideally we'd use a pretty-printing library that prints `undefined`
      // (no quotes), but it might not be worth the bundle size cost.
      return "undefined";
    }
    if (typeof value === "bigint") {
      // `JSON.stringify` throws on bigints by default.
      return `${value.toString()}n`;
    }
    return value;
  });
}

export function patchValueToJson(value: any) {
  return JSON.stringify(value, (_key, value) => {
    if (value === undefined) {
      return "undefined";
    }
    return value;
  });
}
