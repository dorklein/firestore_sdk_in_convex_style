import { Firestore, DocumentSnapshot, Transaction } from "firebase-admin/firestore";
import type { SchemaDefinition } from "./schema.js";
import {
  GenericDataModel,
  GenericTableInfo,
  NamedTableInfo,
  DocumentByName,
} from "./data_model.js";
import { GenericId } from "./values/index.js";

export interface DatabaseReader<DataModel extends GenericDataModel> {
  get<TableName extends keyof DataModel & string>(
    id: GenericId<TableName>
  ): Promise<DocumentByName<DataModel, TableName> | null>;

  query<TableName extends keyof DataModel & string>(
    tableName: TableName
  ): QueryBuilder<NamedTableInfo<DataModel, TableName>>;
}
export type GenericDatabaseReader<DataModel extends GenericDataModel> = DatabaseReader<DataModel>;

export interface DatabaseWriter<DataModel extends GenericDataModel>
  extends DatabaseReader<DataModel> {
  insert<TableName extends keyof DataModel & string>(
    tableName: TableName,
    document: Omit<DocumentByName<DataModel, TableName>, "_id" | "_creationTime">
  ): Promise<GenericId<TableName>>;

  patch<TableName extends keyof DataModel & string>(
    id: GenericId<TableName>,
    partial: Partial<Omit<DocumentByName<DataModel, TableName>, "_id" | "_creationTime">>
  ): Promise<void>;

  replace<TableName extends keyof DataModel & string>(
    id: GenericId<TableName>,
    document: Omit<DocumentByName<DataModel, TableName>, "_id" | "_creationTime">
  ): Promise<void>;

  delete<TableName extends keyof DataModel & string>(id: GenericId<TableName>): Promise<void>;
}
export type GenericDatabaseWriter<DataModel extends GenericDataModel> = DatabaseWriter<DataModel>;

// Query builder for type-safe queries
export class QueryBuilder<TableInfo extends GenericTableInfo> {
  private _whereClauses: Array<{
    field: string;
    op: FirebaseFirestore.WhereFilterOp;
    value: unknown;
  }> = [];
  private _orderBy: Array<{ field: string; direction: "asc" | "desc" }> = [];
  private _limitCount?: number;

  constructor(
    private db: Firestore,
    private collectionPath: string,
    private _schemaDefinition: SchemaDefinition<any, any>
  ) {}

  where<K extends TableInfo["fieldPaths"]>(
    field: K,
    op: FirebaseFirestore.WhereFilterOp,
    value: unknown
  ): this {
    this._whereClauses.push({ field: field as string, op, value });
    return this;
  }

  order<K extends TableInfo["fieldPaths"]>(field: K, direction: "asc" | "desc" = "asc"): this {
    this._orderBy.push({ field: field as string, direction });
    return this;
  }

  limit(count: number): this {
    this._limitCount = count;
    return this;
  }

  async collect(): Promise<Array<TableInfo["document"]>> {
    let query: FirebaseFirestore.Query = this.db.collection(this.collectionPath);

    for (const clause of this._whereClauses) {
      query = query.where(clause.field, clause.op, clause.value);
    }

    for (const order of this._orderBy) {
      query = query.orderBy(order.field, order.direction);
    }

    if (this._limitCount !== undefined) {
      query = query.limit(this._limitCount);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => this.documentToData(doc));
  }

  async first(): Promise<TableInfo["document"] | null> {
    const results = await this.limit(1).collect();
    return results[0] ?? null;
  }

  private documentToData(doc: DocumentSnapshot): TableInfo["document"] {
    const data = doc.data();
    if (!data) {
      throw new Error(`Document ${doc.id} has no data`);
    }

    return {
      ...data,
      _id: `${this.collectionPath}|${doc.id}` as GenericId<string>,
      _creationTime: data._creationTime || Date.now(),
    } as TableInfo["document"];
  }
}

// Database implementation
export class DatabaseImpl<DataModel extends GenericDataModel> implements DatabaseWriter<DataModel> {
  constructor(private db: Firestore, private schemaDefinition: SchemaDefinition<any, any>) {}

  // Expose the Firestore instance for transaction handling
  getFirestore(): Firestore {
    return this.db;
  }

  // Expose the schema for transaction handling
  getSchema(): SchemaDefinition<any, any> {
    return this.schemaDefinition;
  }

  async get<TableName extends keyof DataModel & string>(
    id: GenericId<TableName>
  ): Promise<DocumentByName<DataModel, TableName> | null> {
    // Parse the ID to extract table name and document ID
    const { tableName, docId } = this.parseId(id as string);

    const docRef = this.db.collection(tableName).doc(docId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data) {
      return null;
    }

    return {
      ...data,
      _id: this.createId(tableName as TableName, doc.id),
      _creationTime: data._creationTime || Date.now(),
    } as DocumentByName<DataModel, TableName>;
  }

  query<TableName extends keyof DataModel & string>(
    tableName: TableName
  ): QueryBuilder<NamedTableInfo<DataModel, TableName>> {
    return new QueryBuilder(this.db, tableName as string, this.schemaDefinition);
  }

  async insert<TableName extends keyof DataModel & string>(
    tableName: TableName,
    document: Omit<DocumentByName<DataModel, TableName>, "_id" | "_creationTime">
  ): Promise<GenericId<TableName>> {
    const docRef = this.db.collection(tableName as string).doc();

    // Remove undefined values (Firestore doesn't accept them)
    const cleanedData = Object.fromEntries(
      Object.entries(document).filter(([_, v]) => v !== undefined)
    );

    const dataToInsert = {
      ...cleanedData,
      _creationTime: Date.now(),
    };

    await docRef.set(dataToInsert);
    // Return ID in format "tableName|docId" for proper tracking
    return this.createId(tableName, docRef.id);
  }

  async patch<TableName extends keyof DataModel & string>(
    id: GenericId<TableName>,
    partial: Partial<Omit<DocumentByName<DataModel, TableName>, "_id" | "_creationTime">>
  ): Promise<void> {
    const { tableName, docId } = this.parseId(id as string);

    const cleanedData = Object.fromEntries(
      Object.entries(partial).filter(([_, v]) => v !== undefined)
    );

    const docRef = this.db.collection(tableName).doc(docId);
    await docRef.update(cleanedData);
  }

  async replace<TableName extends keyof DataModel & string>(
    id: GenericId<TableName>,
    document: Omit<DocumentByName<DataModel, TableName>, "_id" | "_creationTime">
  ): Promise<void> {
    const { tableName, docId } = this.parseId(id as string);

    const docRef = this.db.collection(tableName).doc(docId);

    // Get existing creation time
    const existing = await docRef.get();
    const creationTime = existing.data()?._creationTime || Date.now();

    // Remove undefined values (Firestore doesn't accept them)
    const cleanedData = Object.fromEntries(
      Object.entries(document).filter(([_, v]) => v !== undefined)
    );

    await docRef.set({
      ...cleanedData,
      _creationTime: creationTime,
    });
  }

  async delete<TableName extends keyof DataModel & string>(
    id: GenericId<TableName>
  ): Promise<void> {
    const { tableName, docId } = this.parseId(id as string);

    const docRef = this.db.collection(tableName).doc(docId);
    await docRef.delete();
  }

  private parseId(id: string): { tableName: string; docId: string } {
    // IDs are stored as "tableName|docId" to preserve table information
    const parts = id.split("|");
    if (parts.length !== 2) {
      throw new Error(`Invalid ID format: ${id}. Expected "tableName|docId"`);
    }
    return { tableName: parts[0], docId: parts[1] };
  }

  // Helper to create a properly formatted ID
  createId<TableName extends string>(tableName: TableName, docId: string): GenericId<TableName> {
    return `${tableName}|${docId}` as GenericId<TableName>;
  }
}

// Transactional Database implementation for mutations
export class TransactionalDatabaseImpl<DataModel extends GenericDataModel>
  implements DatabaseWriter<DataModel>
{
  constructor(
    private db: Firestore,
    private schemaDefinition: SchemaDefinition<any, any>,
    private transaction: Transaction
  ) {}

  async get<TableName extends keyof DataModel & string>(
    id: GenericId<TableName>
  ): Promise<DocumentByName<DataModel, TableName> | null> {
    const { tableName, docId } = this.parseId(id as string);

    const docRef = this.db.collection(tableName).doc(docId);
    const doc = await this.transaction.get(docRef);

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data) {
      return null;
    }

    return {
      ...data,
      _id: this.createId(tableName as TableName, doc.id),
      _creationTime: data._creationTime || Date.now(),
    } as DocumentByName<DataModel, TableName>;
  }

  query<TableName extends keyof DataModel & string>(
    tableName: TableName
  ): QueryBuilder<NamedTableInfo<DataModel, TableName>> {
    // Note: Queries in transactions are read-only and execute immediately
    return new QueryBuilder(this.db, tableName as string, this.schemaDefinition);
  }

  async insert<TableName extends keyof DataModel & string>(
    tableName: TableName,
    document: Omit<DocumentByName<DataModel, TableName>, "_id" | "_creationTime">
  ): Promise<GenericId<TableName>> {
    const docRef = this.db.collection(tableName as string).doc();

    // Remove undefined values (Firestore doesn't accept them)
    const cleanedData = Object.fromEntries(
      Object.entries(document).filter(([_, v]) => v !== undefined)
    );

    const dataToInsert = {
      ...cleanedData,
      _creationTime: Date.now(),
    };

    // Use transaction.set instead of direct set
    this.transaction.set(docRef, dataToInsert);

    // Return ID in format "tableName|docId" for proper tracking
    return this.createId(tableName, docRef.id);
  }

  async patch<TableName extends keyof DataModel & string>(
    id: GenericId<TableName>,
    partial: Partial<Omit<DocumentByName<DataModel, TableName>, "_id" | "_creationTime">>
  ): Promise<void> {
    const { tableName, docId } = this.parseId(id as string);

    const cleanedData = Object.fromEntries(
      Object.entries(partial).filter(([_, v]) => v !== undefined)
    );

    const docRef = this.db.collection(tableName).doc(docId);
    this.transaction.update(docRef, cleanedData);
  }

  async replace<TableName extends keyof DataModel & string>(
    id: GenericId<TableName>,
    document: Omit<DocumentByName<DataModel, TableName>, "_id" | "_creationTime">
  ): Promise<void> {
    const { tableName, docId } = this.parseId(id as string);

    const docRef = this.db.collection(tableName).doc(docId);

    // Get existing creation time
    const existing = await this.transaction.get(docRef);
    const creationTime = existing.data()?._creationTime || Date.now();

    // Remove undefined values (Firestore doesn't accept them)
    const cleanedData = Object.fromEntries(
      Object.entries(document).filter(([_, v]) => v !== undefined)
    );

    this.transaction.set(docRef, {
      ...cleanedData,
      _creationTime: creationTime,
    });
  }

  async delete<TableName extends keyof DataModel & string>(
    id: GenericId<TableName>
  ): Promise<void> {
    const { tableName, docId } = this.parseId(id as string);

    const docRef = this.db.collection(tableName).doc(docId);
    this.transaction.delete(docRef);
  }

  private parseId(id: string): { tableName: string; docId: string } {
    const parts = id.split("|");
    if (parts.length !== 2) {
      throw new Error(`Invalid ID format: ${id}. Expected "tableName|docId"`);
    }
    return { tableName: parts[0], docId: parts[1] };
  }

  private createId<TableName extends string>(
    tableName: TableName,
    docId: string
  ): GenericId<TableName> {
    return `${tableName}|${docId}` as GenericId<TableName>;
  }
}
