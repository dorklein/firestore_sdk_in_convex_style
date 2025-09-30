import { Firestore, DocumentSnapshot } from "firebase-admin/firestore";
import type { Schema, SchemaDefinition, ExtractDataModel } from "./schema";
import type { DocumentId } from "./validators";

export interface DatabaseReader<DataModel extends Record<string, any>> {
  get<TableName extends keyof DataModel>(
    id: DocumentId<TableName & string>
  ): Promise<DataModel[TableName] | null>;

  query<TableName extends keyof DataModel>(
    tableName: TableName
  ): QueryBuilder<DataModel[TableName]>;
}

export interface DatabaseWriter<DataModel extends Record<string, any>>
  extends DatabaseReader<DataModel> {
  insert<TableName extends keyof DataModel>(
    tableName: TableName,
    document: Omit<DataModel[TableName], "_id" | "_creationTime">
  ): Promise<DocumentId<TableName & string>>;

  patch<TableName extends keyof DataModel>(
    id: DocumentId<TableName & string>,
    partial: Partial<Omit<DataModel[TableName], "_id" | "_creationTime">>
  ): Promise<void>;

  replace<TableName extends keyof DataModel>(
    id: DocumentId<TableName & string>,
    document: Omit<DataModel[TableName], "_id" | "_creationTime">
  ): Promise<void>;

  delete<TableName extends keyof DataModel>(id: DocumentId<TableName & string>): Promise<void>;
}

// Query builder for type-safe queries
export class QueryBuilder<Doc> {
  private _whereClauses: Array<{ field: string; op: FirebaseFirestore.WhereFilterOp; value: any }> =
    [];
  private _orderBy: Array<{ field: string; direction: "asc" | "desc" }> = [];
  private _limitCount?: number;

  constructor(
    private db: Firestore,
    private collectionPath: string,
    private schema: Schema<any>,
    private tableName: string
  ) {}

  where<K extends keyof Doc>(field: K, op: FirebaseFirestore.WhereFilterOp, value: any): this {
    this._whereClauses.push({ field: field as string, op, value });
    return this;
  }

  order<K extends keyof Doc>(field: K, direction: "asc" | "desc" = "asc"): this {
    this._orderBy.push({ field: field as string, direction });
    return this;
  }

  limit(count: number): this {
    this._limitCount = count;
    return this;
  }

  async collect(): Promise<Doc[]> {
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

  async first(): Promise<Doc | null> {
    const results = await this.limit(1).collect();
    return results[0] ?? null;
  }

  private documentToData(doc: DocumentSnapshot): Doc {
    const data = doc.data();
    if (!data) {
      throw new Error(`Document ${doc.id} has no data`);
    }

    // Validate against schema
    const validated = this.schema.validateDocument(this.tableName, data);

    return {
      ...validated,
      _id: `${this.tableName}:${doc.id}`,
      _creationTime: data._creationTime || Date.now(),
    } as Doc;
  }
}

// Database implementation
export class Database<S extends SchemaDefinition> implements DatabaseWriter<ExtractDataModel<S>> {
  constructor(private db: Firestore, private schema: Schema<S>) {}

  async get<TableName extends keyof ExtractDataModel<S>>(
    id: DocumentId<TableName & string>
  ): Promise<ExtractDataModel<S>[TableName] | null> {
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

    // Validate against schema
    const validated = this.schema.validateDocument(tableName, data);

    return {
      ...validated,
      _id: this.createId(tableName, doc.id),
      _creationTime: data._creationTime || Date.now(),
    } as ExtractDataModel<S>[TableName];
  }

  query<TableName extends keyof ExtractDataModel<S>>(
    tableName: TableName
  ): QueryBuilder<ExtractDataModel<S>[TableName]> {
    return new QueryBuilder(this.db, tableName as string, this.schema, tableName as string);
  }

  async insert<TableName extends keyof ExtractDataModel<S>>(
    tableName: TableName,
    document: Omit<ExtractDataModel<S>[TableName], "_id" | "_creationTime">
  ): Promise<DocumentId<TableName & string>> {
    // Validate against schema
    const validated = this.schema.validateDocument(tableName as string, document);

    const docRef = this.db.collection(tableName as string).doc();

    const dataToInsert = {
      ...validated,
      _creationTime: Date.now(),
    };

    await docRef.set(dataToInsert);
    // Return ID in format "tableName:docId" for proper tracking
    return this.createId(tableName as TableName & string, docRef.id);
  }

  async patch<TableName extends keyof ExtractDataModel<S>>(
    id: DocumentId<TableName & string>,
    partial: Partial<Omit<ExtractDataModel<S>[TableName], "_id" | "_creationTime">>
  ): Promise<void> {
    const { tableName, docId } = this.parseId(id as string);

    const docRef = this.db.collection(tableName).doc(docId);
    await docRef.update(partial as any);
  }

  async replace<TableName extends keyof ExtractDataModel<S>>(
    id: DocumentId<TableName & string>,
    document: Omit<ExtractDataModel<S>[TableName], "_id" | "_creationTime">
  ): Promise<void> {
    const { tableName, docId } = this.parseId(id as string);

    // Validate against schema
    const validated = this.schema.validateDocument(tableName, document);

    const docRef = this.db.collection(tableName).doc(docId);

    // Get existing creation time
    const existing = await docRef.get();
    const creationTime = existing.data()?._creationTime || Date.now();

    await docRef.set({
      ...validated,
      _creationTime: creationTime,
    });
  }

  async delete<TableName extends keyof ExtractDataModel<S>>(
    id: DocumentId<TableName & string>
  ): Promise<void> {
    const { tableName, docId } = this.parseId(id as string);

    const docRef = this.db.collection(tableName).doc(docId);
    await docRef.delete();
  }

  private parseId(id: string): { tableName: string; docId: string } {
    // IDs are stored as "tableName:docId" to preserve table information
    const parts = id.split(":");
    if (parts.length !== 2) {
      throw new Error(`Invalid ID format: ${id}. Expected "tableName:docId"`);
    }
    return { tableName: parts[0], docId: parts[1] };
  }

  // Helper to create a properly formatted ID
  createId<TableName extends string>(tableName: TableName, docId: string): DocumentId<TableName> {
    return `${tableName}:${docId}` as DocumentId<TableName>;
  }
}
