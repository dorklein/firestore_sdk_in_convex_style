import * as v from "valibot";
import type { Validator } from "./validators";

// Extract the TypeScript type from a validator
export type Infer<V extends Validator> = V["_type"];

// Extract the TypeScript type from a table definition
export type InferTableType<T extends TableDefinition<any>> = {
  [K in keyof T["fields"]]: T["fields"][K]["_type"];
} & {
  _id: string;
  _creationTime: number;
};

// Table definition with fields and indexes
export interface TableDefinition<Fields extends Record<string, Validator>> {
  fields: Fields;
  indexes: Index[];
}

export interface Index {
  name: string;
  fields: string[];
}

// Table builder for fluent API
export class TableBuilder<Fields extends Record<string, Validator>> {
  private _indexes: Index[] = [];

  constructor(private fields: Fields) {}

  index(name: string, fields: (keyof Fields)[]): this {
    this._indexes.push({ name, fields: fields as string[] });
    return this;
  }

  build(): TableDefinition<Fields> {
    return {
      fields: this.fields,
      indexes: this._indexes,
    };
  }
}

// Define a table with fields
export function defineTable<Fields extends Record<string, Validator>>(
  fields: Fields
): TableBuilder<Fields> {
  return new TableBuilder(fields);
}

// Schema definition
export type SchemaDefinition = Record<string, TableDefinition<any> | TableBuilder<any>>;

export type DataModel = Record<string, Record<string, any>>;

// Helper to extract data model types from schema
export type ExtractDataModel<S extends SchemaDefinition | Schema<any>> = S extends Schema<
  infer SchemaDefType
>
  ? ExtractDataModel<SchemaDefType>
  : S extends SchemaDefinition
  ? {
      [TableName in keyof S]: S[TableName] extends TableDefinition<infer Fields>
        ? InferTableType<TableDefinition<Fields>>
        : S[TableName] extends TableBuilder<infer Fields>
        ? InferTableType<TableDefinition<Fields>>
        : never;
    }
  : never;

// Normalize a schema definition to convert all TableBuilders to TableDefinitions
export type NormalizedSchema<S extends SchemaDefinition> = {
  [K in keyof S]: S[K] extends TableBuilder<infer Fields>
    ? TableDefinition<Fields>
    : S[K] extends TableDefinition<infer Fields>
    ? TableDefinition<Fields>
    : never;
};

// Define schema
export function defineSchema<S extends SchemaDefinition>(schema: S): Schema<NormalizedSchema<S>> {
  // Convert builders to definitions
  const definitions: Record<string, TableDefinition<any>> = {};
  for (const [tableName, table] of Object.entries(schema)) {
    if (table instanceof TableBuilder) {
      definitions[tableName] = table.build();
    } else {
      definitions[tableName] = table;
    }
  }

  return new Schema(definitions);
}

export class Schema<S extends SchemaDefinition = SchemaDefinition> {
  // Type marker to preserve the schema definition type for type inference
  // @ts-expect-error - This field is used only for type inference and is intentionally unused at runtime
  private readonly _schemaType?: S;

  constructor(public readonly tables: Record<string, TableDefinition<any>>) {}

  getTable(tableName: string): TableDefinition<any> | undefined {
    return this.tables[tableName];
  }

  validateDocument(tableName: string, data: any): any {
    const table = this.getTable(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found in schema`);
    }

    const schemaFields: Record<string, any> = {};
    for (const [key, validator] of Object.entries(table.fields)) {
      schemaFields[key] = (validator as Validator)._schema;
    }

    const schema = v.object(schemaFields);
    return v.parse(schema, data);
  }
}
