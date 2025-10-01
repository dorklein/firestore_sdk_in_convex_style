import * as v from "valibot";

// Brand type for document IDs to ensure type safety
export type DocumentId<TableName extends string> = string & { __tableName: TableName };

// Base validator types
export interface Validator<T = any> {
  _type: T;
  _schema: v.BaseSchema<any, any, any>;
  _isOptional?: boolean;
}

// String validator
export function string(): Validator<string> {
  return {
    _type: undefined as any,
    _schema: v.string(),
    _isOptional: false,
  };
}

// Number validator
export function number(): Validator<number> {
  return {
    _type: undefined as any,
    _schema: v.number(),
    _isOptional: false,
  };
}

// Boolean validator
export function boolean(): Validator<boolean> {
  return {
    _type: undefined as any,
    _schema: v.boolean(),
    _isOptional: false,
  };
}

// ID validator - creates a branded string type
export function id<TableName extends string>(
  tableName: TableName
): Validator<DocumentId<TableName>> {
  return {
    _type: undefined as any,
    _schema: v.pipe(v.string(), v.brand(tableName)),
    _isOptional: false,
  };
}

// Optional validator wrapper
export function optional<T>(validator: Validator<T>): Validator<T | undefined> {
  return {
    _type: undefined as any,
    _schema: v.optional(validator._schema),
    _isOptional: true,
  };
}

// Array validator
export function array<T>(validator: Validator<T>): Validator<T[]> {
  return {
    _type: undefined as any,
    _schema: v.array(validator._schema),
    _isOptional: false,
  };
}

// Object validator for nested objects
export function object<T extends Record<string, Validator>>(
  fields: T
): Validator<{ [K in keyof T]: T[K]["_type"] }> {
  const schemaFields: Record<string, any> = {};
  for (const [key, validator] of Object.entries(fields)) {
    schemaFields[key] = validator._schema;
  }
  return {
    _type: undefined as any,
    _schema: v.object(schemaFields),
    _isOptional: false,
  };
}

// Record validator for dynamic key-value pairs
export function record<K extends string | number, V>(
  keyValidator: Validator<K>,
  valueValidator: Validator<V>
): Validator<Record<K, V>> {
  return {
    _type: undefined as any,
    _schema: v.record(keyValidator._schema, valueValidator._schema),
    _isOptional: false,
  };
}

// Literal validator
export function literal<T extends string | number | boolean>(value: T): Validator<T> {
  return {
    _type: undefined as any,
    _schema: v.literal(value),
    _isOptional: false,
  };
}

// Union validator
export function union<T extends Validator[]>(...validators: T): Validator<T[number]["_type"]> {
  return {
    _type: undefined as any,
    _schema: v.union(validators.map((v) => v._schema) as any),
    _isOptional: false,
  };
}

// Picklist validator - simpler alternative to union for literal values
export function picklist<T extends readonly [string, ...string[]]>(
  options: T
): Validator<T[number]> {
  return {
    _type: undefined as any,
    _schema: v.picklist(options),
    _isOptional: false,
  };
}

// Any validator
export function any(): Validator<any> {
  return {
    _type: undefined as any,
    _schema: v.any(),
    _isOptional: false,
  };
}

// Export all validators under 'v' namespace for convenience
export const validators = {
  string,
  number,
  boolean,
  id,
  optional,
  array,
  object,
  record,
  literal,
  union,
  picklist,
  any,
};
