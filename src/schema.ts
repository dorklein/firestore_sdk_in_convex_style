import { AnyDataModel, GenericDataModel } from "./data_model.js";
import { IdField, SystemFields } from "./system_fields.js";
import { Expand } from "./type_utils.js";
import { GenericValidator, ObjectType, Validator, VObject, v } from "./values/index.js";
import { isValidator } from "./values/validator.js";

/**
 * Extract all of the index field paths within a {@link Validator}.
 *
 * This is used within {@link defineTable}.
 * @public
 */
type ExtractFieldPaths<T extends Validator<any, any, any>> =
  // Add in the system fields available in index definitions.
  // This should be everything except for `_id` because thats added to indexes
  // automatically.
  T["fieldPaths"] | keyof SystemFields;

/**
 * Extract the {@link GenericDocument} within a {@link Validator} and
 * add on the system fields.
 *
 * This is used within {@link defineTable}.
 * @public
 */
type ExtractDocument<T extends Validator<any, any, any>> =
  // Add the system fields to `Value` (except `_id` because it depends on
  //the table name) and trick TypeScript into expanding them.
  Expand<SystemFields & T["type"]>;

// // Extract the TypeScript type from a validator
// export type Infer<V extends Validator> = V["_type"];

// // Extract the TypeScript type from a table definition
// export type InferTableType<T extends TableDefinition<any>> = {
//   [K in keyof T["fields"]]: T["fields"][K]["_type"];
// } & {
//   _id: string;
//   _creationTime: number;
// };

/**
 * The definition of a table within a schema.
 *
 * This should be produced by using {@link defineTable}.
 * @public
 */
export class TableDefinition<
  DocumentType extends Validator<any, any, any> = Validator<any, any, any>
> {
  // The type of documents stored in this table.
  validator: DocumentType;

  /**
   * @internal
   */
  constructor(documentType: DocumentType) {
    this.validator = documentType;
  }

  /**
   * Work around for https://github.com/microsoft/TypeScript/issues/57035
   */
  protected self(): TableDefinition<DocumentType> {
    return this;
  }
  /**
   * Export the contents of this definition.
   *
   * This is called internally by the Convex framework.
   * @internal
   */
  export() {
    return {
      documentType: this.validator.json,
    };
  }
}

export interface Index {
  name: string;
  fields: string[];
}

// // Table builder for fluent API
// export class TableBuilder<Fields extends Record<string, Validator>> {
//   private _indexes: Index[] = [];

//   constructor(private fields: Fields) {}

//   index(name: string, fields: (keyof Fields)[]): this {
//     this._indexes.push({ name, fields: fields as string[] });
//     return this;
//   }

//   build(): TableDefinition<Fields> {
//     return {
//       fields: this.fields,
//       indexes: this._indexes,
//     };
//   }
// }

/**
 * Define a table in a schema.
 *
 * You can either specify the schema of your documents as an object like
 * ```ts
 * defineTable({
 *   field: v.string()
 * });
 * ```
 *
 * or as a schema type like
 * ```ts
 * defineTable(
 *  v.union(
 *    v.object({...}),
 *    v.object({...})
 *  )
 * );
 * ```
 *
 * @param documentSchema - The type of documents stored in this table.
 * @returns A {@link TableDefinition} for the table.
 *
 * @public
 */
export function defineTable<DocumentSchema extends Validator<Record<string, any>, "required", any>>(
  documentSchema: DocumentSchema
): TableDefinition<DocumentSchema>;
/**
 * Define a table in a schema.
 *
 * You can either specify the schema of your documents as an object like
 * ```ts
 * defineTable({
 *   field: v.string()
 * });
 * ```
 *
 * or as a schema type like
 * ```ts
 * defineTable(
 *  v.union(
 *    v.object({...}),
 *    v.object({...})
 *  )
 * );
 * ```
 *
 * @param documentSchema - The type of documents stored in this table.
 * @returns A {@link TableDefinition} for the table.
 *
 * @public
 */
export function defineTable<DocumentSchema extends Record<string, GenericValidator>>(
  documentSchema: DocumentSchema
): TableDefinition<VObject<ObjectType<DocumentSchema>, DocumentSchema>>;
export function defineTable<
  DocumentSchema extends
    | Validator<Record<string, any>, "required", any>
    | Record<string, GenericValidator>
>(documentSchema: DocumentSchema): TableDefinition<any> {
  if (isValidator(documentSchema)) {
    return new TableDefinition(documentSchema);
  } else {
    return new TableDefinition(v.object(documentSchema));
  }
}

/**
 * A type describing the schema of a Convex project.
 *
 * This should be constructed using {@link defineSchema}, {@link defineTable},
 * and {@link v}.
 * @public
 */
export type GenericSchema = Record<string, TableDefinition>;

/**
 *
 * The definition of a Convex project schema.
 *
 * This should be produced by using {@link defineSchema}.
 * @public
 */
export class SchemaDefinition<Schema extends GenericSchema, StrictTableTypes extends boolean> {
  public tables: Schema;
  public strictTableNameTypes!: StrictTableTypes;
  private readonly schemaValidation: boolean;

  /**
   * @internal
   */
  constructor(tables: Schema, options?: DefineSchemaOptions<StrictTableTypes>) {
    this.tables = tables;
    this.schemaValidation =
      options?.schemaValidation === undefined ? true : options.schemaValidation;
  }

  /**
   * Export the contents of this definition.
   *
   * This is called internally by the Convex framework.
   * @internal
   */
  export(): string {
    return JSON.stringify({
      tables: Object.entries(this.tables).map(([tableName, definition]) => {
        const { documentType } = definition.export();
        return {
          tableName,
          documentType,
        };
      }),
      schemaValidation: this.schemaValidation,
    });
  }
}
/**
 * Options for {@link defineSchema}.
 *
 * @public
 */
export interface DefineSchemaOptions<StrictTableNameTypes extends boolean> {
  /**
   * Whether Convex should validate at runtime that all documents match
   * your schema.
   *
   * If `schemaValidation` is `true`, Convex will:
   * 1. Check that all existing documents match your schema when your schema
   * is pushed.
   * 2. Check that all insertions and updates match your schema during mutations.
   *
   * If `schemaValidation` is `false`, Convex will not validate that new or
   * existing documents match your schema. You'll still get schema-specific
   * TypeScript types, but there will be no validation at runtime that your
   * documents match those types.
   *
   * By default, `schemaValidation` is `true`.
   */
  schemaValidation?: boolean;

  /**
   * Whether the TypeScript types should allow accessing tables not in the schema.
   *
   * If `strictTableNameTypes` is `true`, using tables not listed in the schema
   * will generate a TypeScript compilation error.
   *
   * If `strictTableNameTypes` is `false`, you'll be able to access tables not
   * listed in the schema and their document type will be `any`.
   *
   * `strictTableNameTypes: false` is useful for rapid prototyping.
   *
   * Regardless of the value of `strictTableNameTypes`, your schema will only
   * validate documents in the tables listed in the schema. You can still create
   * and modify other tables on the dashboard or in JavaScript mutations.
   *
   * By default, `strictTableNameTypes` is `true`.
   */
  strictTableNameTypes?: StrictTableNameTypes;
}

/**
 * Define the schema of this Convex project.
 *
 * This should be exported from a `schema.ts` file in your `convex/` directory
 * like:
 *
 * ```ts
 * export default defineSchema({
 *   ...
 * });
 * ```
 *
 * @param schema - A map from table name to {@link TableDefinition} for all of
 * the tables in this project.
 * @param options - Optional configuration. See {@link DefineSchemaOptions} for
 * a full description.
 * @returns The schema.
 *
 * @public
 */
export function defineSchema<
  Schema extends GenericSchema,
  StrictTableNameTypes extends boolean = true
>(
  schema: Schema,
  options?: DefineSchemaOptions<StrictTableNameTypes>
): SchemaDefinition<Schema, StrictTableNameTypes> {
  return new SchemaDefinition(schema, options);
}

/**
 * Internal type used in Convex code generation!
 *
 * Convert a {@link SchemaDefinition} into a {@link server.GenericDataModel}.
 *
 * @public
 */
export type DataModelFromSchemaDefinition<SchemaDef extends SchemaDefinition<any, boolean>> =
  MaybeMakeLooseDataModel<
    {
      [TableName in keyof SchemaDef["tables"] &
        string]: SchemaDef["tables"][TableName] extends TableDefinition<infer DocumentType>
        ? {
            // We've already added all of the system fields except for `_id`.
            // Add that here.
            document: Expand<IdField<TableName> & ExtractDocument<DocumentType>>;
            fieldPaths: keyof IdField<TableName> | ExtractFieldPaths<DocumentType>;
          }
        : never;
    },
    SchemaDef["strictTableNameTypes"]
  >;

type MaybeMakeLooseDataModel<
  DataModel extends GenericDataModel,
  StrictTableNameTypes extends boolean
> = StrictTableNameTypes extends true ? DataModel : Expand<DataModel & AnyDataModel>;

// export type DataModel = Record<string, Record<string, any>>;

// // Helper to extract data model types from schema
// export type ExtractDataModel<S extends SchemaDefinition | Schema<any>> = S extends Schema<
//   infer SchemaDefType
// >
//   ? ExtractDataModel<SchemaDefType>
//   : S extends SchemaDefinition
//   ? {
//       [TableName in keyof S]: S[TableName] extends TableDefinition<infer Fields>
//         ? InferTableType<TableDefinition<Fields>>
//         : S[TableName] extends TableBuilder<infer Fields>
//         ? InferTableType<TableDefinition<Fields>>
//         : never;
//     }
//   : never;

// // Normalize a schema definition to convert all TableBuilders to TableDefinitions
// export type NormalizedSchema<S extends SchemaDefinition> = {
//   [K in keyof S]: S[K] extends TableBuilder<infer Fields>
//     ? TableDefinition<Fields>
//     : S[K] extends TableDefinition<infer Fields>
//     ? TableDefinition<Fields>
//     : never;
// };

// export class Schema<S extends SchemaDefinition = SchemaDefinition> {
//   // Type marker to preserve the schema definition type for type inference
//   // @ts-expect-error - This field is used only for type inference and is intentionally unused at runtime
//   private readonly _schemaType?: S;

//   constructor(public readonly tables: Record<string, TableDefinition<any>>) {}

//   getTable(tableName: string): TableDefinition<any> | undefined {
//     return this.tables[tableName];
//   }

//   validateDocument(tableName: string, data: any): any {
//     const table = this.getTable(tableName);
//     if (!table) {
//       throw new Error(`Table ${tableName} not found in schema`);
//     }

//     const schemaFields: Record<string, any> = {};
//     for (const [key, validator] of Object.entries(table.fields)) {
//       schemaFields[key] = (validator as Validator)._schema;
//     }

//     const schema = v.object(schemaFields);
//     return v.parse(schema, data);
//   }
// }
