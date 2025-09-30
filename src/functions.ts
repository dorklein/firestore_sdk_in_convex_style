import { Firestore } from "firebase-admin/firestore";
import * as v from "valibot";
import type { Schema, SchemaDefinition, ExtractDataModel } from "./schema";
import { Database, DatabaseReader, DatabaseWriter } from "./database";
import type { Validator } from "./validators";

// Context types
export interface QueryContext<DataModel extends Record<string, any>> {
  db: DatabaseReader<DataModel>;
}

export interface MutationContext<DataModel extends Record<string, any>> {
  db: DatabaseWriter<DataModel>;
}

// Function definition types
export interface QueryDefinition<
  DataModel extends Record<string, any>,
  Args extends Record<string, Validator>,
  Output
> {
  args: Args;
  handler: (
    ctx: QueryContext<DataModel>,
    args: { [K in keyof Args]: Args[K]["_type"] }
  ) => Promise<Output>;
  _type: "query";
}

export interface MutationDefinition<
  DataModel extends Record<string, any>,
  Args extends Record<string, Validator>,
  Output
> {
  args: Args;
  handler: (
    ctx: MutationContext<DataModel>,
    args: { [K in keyof Args]: Args[K]["_type"] }
  ) => Promise<Output>;
  _type: "mutation";
}

// Query and mutation builders
export function query<
  S extends SchemaDefinition,
  Args extends Record<string, Validator>,
  Output
>(definition: {
  args: Args;
  handler: (
    ctx: QueryContext<ExtractDataModel<S>>,
    args: { [K in keyof Args]: Args[K]["_type"] }
  ) => Promise<Output>;
}): QueryDefinition<ExtractDataModel<S>, Args, Output> {
  return {
    ...definition,
    _type: "query",
  };
}

export function mutation<
  S extends SchemaDefinition,
  Args extends Record<string, Validator>,
  Output
>(definition: {
  args: Args;
  handler: (
    ctx: MutationContext<ExtractDataModel<S>>,
    args: { [K in keyof Args]: Args[K]["_type"] }
  ) => Promise<Output>;
}): MutationDefinition<ExtractDataModel<S>, Args, Output> {
  return {
    ...definition,
    _type: "mutation",
  };
}

export function internalQuery<
  DataModel extends Record<string, any> = any,
  Args extends Record<string, Validator> = any,
  Output = any
>(definition: {
  args: Args;
  handler: (
    ctx: QueryContext<DataModel>,
    args: { [K in keyof Args]: Args[K]["_type"] }
  ) => Promise<Output>;
}): QueryDefinition<DataModel, Args, Output> {
  return {
    ...definition,
    _type: "query",
  };
}

export function internalMutation<
  DataModel extends Record<string, any> = any,
  Args extends Record<string, Validator> = any,
  Output = any
>(definition: {
  args: Args;
  handler: (
    ctx: MutationContext<DataModel>,
    args: { [K in keyof Args]: Args[K]["_type"] }
  ) => Promise<Output>;
}): MutationDefinition<DataModel, Args, Output> {
  return {
    ...definition,
    _type: "mutation",
  };
}

// Runtime execution
export class FunctionRunner<S extends SchemaDefinition> {
  private db: Database<S>;

  constructor(firestore: Firestore, private schema: Schema<S>) {
    this.db = new Database(firestore, schema);
  }

  // Expose schema for potential future use
  getSchema(): Schema<S> {
    return this.schema;
  }

  async runQuery<Args extends Record<string, Validator>, Output>(
    definition: QueryDefinition<ExtractDataModel<S>, Args, Output>,
    rawArgs: unknown
  ): Promise<Output> {
    // Validate arguments
    const args = this.validateArgs(definition.args, rawArgs);

    // Create context
    const ctx: QueryContext<ExtractDataModel<S>> = {
      db: this.db,
    };

    // Execute handler
    return await definition.handler(ctx, args);
  }

  async runMutation<Args extends Record<string, Validator>, Output>(
    definition: MutationDefinition<ExtractDataModel<S>, Args, Output>,
    rawArgs: unknown
  ): Promise<Output> {
    // Validate arguments
    const args = this.validateArgs(definition.args, rawArgs);

    // Create context
    const ctx: MutationContext<ExtractDataModel<S>> = {
      db: this.db,
    };

    // Execute handler
    return await definition.handler(ctx, args);
  }

  private validateArgs<Args extends Record<string, Validator>>(
    argsSchema: Args,
    rawArgs: unknown
  ): { [K in keyof Args]: Args[K]["_type"] } {
    const schemaFields: Record<string, any> = {};
    for (const [key, validator] of Object.entries(argsSchema)) {
      schemaFields[key] = validator._schema;
    }

    const schema = v.object(schemaFields);
    return v.parse(schema, rawArgs) as any;
  }
}
