import { jsonToConvex, GenericId } from "../../values/index.js";
import { performAsyncSyscall, performSyscall } from "./syscall.js";
import { Query } from "../query.js";
import { GenericTableInfo } from "../data_model.js";
import { validateArg, validateArgIsNonNegativeInteger } from "./validate.js";
import { version } from "../../version.js";
import { DocumentSnapshot, Firestore } from "firebase-admin/firestore";

type SerializedQuery = {
  db: Firestore;
  collectionPath: string;
};

/**
 * @param type Whether the query was consumed or closed.
 * @throws An error indicating the query has been closed.
 */
function throwClosedError(type: "closed" | "consumed"): never {
  throw new Error(
    type === "consumed"
      ? "This query is closed and can't emit any more values."
      : "This query has been chained with another operator and can't be reused."
  );
}

// Query builder for type-safe queries
export class QueryImpl<TableInfo extends GenericTableInfo> implements Query<TableInfo> {
  private state:
    | { type: "preparing"; query: SerializedQuery }
    | { type: "executing"; queryId: number }
    | { type: "closed" }
    | { type: "consumed" };
  private _whereClauses: Array<{
    field: string;
    op: FirebaseFirestore.WhereFilterOp;
    value: unknown;
  }> = [];
  private _orderBy: Array<{ field: string; order: "asc" | "desc" }> = [];
  private _limitCount?: number;
  private db: Firestore;
  private collectionPath: string;

  constructor(query: SerializedQuery) {
    this.state = { type: "preparing", query };
    this.db = query.db;
    this.collectionPath = query.collectionPath;
  }

  //   private takeQuery(): SerializedQuery {
  //     if (this.state.type !== "preparing") {
  //       throw new Error(
  //         "A query can only be chained once and can't be chained after iteration begins."
  //       );
  //     }
  //     const query = this.state.query;
  //     this.state = { type: "closed" };
  //     return query;
  //   }

  private startQuery(): number {
    if (this.state.type === "executing") {
      throw new Error("Iteration can only begin on a query once.");
    }
    if (this.state.type === "closed" || this.state.type === "consumed") {
      throwClosedError(this.state.type);
    }
    const query = this.state.query;
    const { queryId } = performSyscall("1.0/queryStream", { query, version });
    this.state = { type: "executing", queryId };
    return queryId;
  }

  private closeQuery() {
    if (this.state.type === "executing") {
      const queryId = this.state.queryId;
      performSyscall("1.0/queryCleanup", { queryId });
    }
    this.state = { type: "consumed" };
  }

  where<K extends TableInfo["fieldPaths"]>(
    field: K,
    op: FirebaseFirestore.WhereFilterOp,
    value: unknown
  ): this {
    this._whereClauses.push({ field: field as string, op, value });
    return this;
  }

  order<K extends TableInfo["fieldPaths"]>(field: K, order: "asc" | "desc" = "asc"): this {
    this._orderBy.push({ field: field as string, order });
    return this;
  }

  limit(count: number): this {
    this._limitCount = count;
    return this;
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<any> {
    this.startQuery();
    return this;
  }

  async next(): Promise<IteratorResult<any>> {
    if (this.state.type === "closed" || this.state.type === "consumed") {
      throwClosedError(this.state.type);
    }
    // Allow calling `.next()` when the query is in "preparing" state to implicitly start the
    // query. This allows the developer to call `.next()` on the query without having to use
    // a `for await` statement.
    const queryId = this.state.type === "preparing" ? this.startQuery() : this.state.queryId;
    const { value, done } = await performAsyncSyscall("1.0/queryStreamNext", {
      queryId,
    });
    if (done) {
      this.closeQuery();
    }
    const convexValue = jsonToConvex(value);
    return { value: convexValue, done };
  }

  return() {
    this.closeQuery();
    return Promise.resolve({ done: true, value: undefined });
  }

  async collect(): Promise<Array<TableInfo["document"]>> {
    let query: FirebaseFirestore.Query = this.db.collection(this.collectionPath);

    for (const clause of this._whereClauses) {
      query = query.where(clause.field, clause.op, clause.value);
    }

    for (const order of this._orderBy) {
      query = query.orderBy(order.field, order.order);
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

  async take(n: number): Promise<Array<TableInfo["document"]>> {
    validateArg(n, 1, "take", "n");
    validateArgIsNonNegativeInteger(n, 1, "take", "n");
    return this.limit(n).collect();
  }

  /**
   * Execute the query and return the singular result if there is one.
   *
   * @returns - The single result returned from the query or null if none exists.
   * @throws  Will throw an error if the query returns more than one result.
   */
  async unique(): Promise<TableInfo["document"] | null> {
    const results = await this.limit(1).collect();
    if (results.length > 1) {
      throw new Error(
        `unique() query returned more than one result from table ${this.collectionPath}`
      );
    }

    return results[0] ?? null;
  }

  private documentToData(doc: DocumentSnapshot<TableInfo["document"]>): TableInfo["document"] {
    const data = doc.data();
    if (!data) {
      throw new Error(`Document ${doc.id} has no data`);
    }

    return {
      ...data,
      _id: `${this.collectionPath}|${doc.id}` as GenericId<string>,
      _creationTime: data._creationTime || Date.now(),
    } satisfies TableInfo["document"];
  }
}

/// TODO: Implement this
// // Transactional Query builder for type-safe queries
// export class TransactionalQueryImpl<TableInfo extends GenericTableInfo>
//   implements Query<TableInfo>
// {
//   private state:
//     | { type: "preparing"; query: SerializedTransactionQuery }
//     | { type: "executing"; queryId: number }
//     | { type: "closed" }
//     | { type: "consumed" };
//   private _whereClauses: Array<{
//     field: string;
//     op: FirebaseFirestore.WhereFilterOp;
//     value: unknown;
//   }> = [];
//   private _orderBy: Array<{ field: string; order: "asc" | "desc" }> = [];
//   private _limitCount?: number;
//   private transaction: Transaction;
//   private collectionPath: string;

//   constructor(query: SerializedTransactionQuery) {
//     this.state = { type: "preparing", query };
//     this.transaction = query.transaction;
//     this.collectionPath = query.collectionPath;
//   }

//   private takeQuery(): SerializedTransactionQuery {
//     if (this.state.type !== "preparing") {
//       throw new Error(
//         "A query can only be chained once and can't be chained after iteration begins."
//       );
//     }
//     const query = this.state.query;
//     this.state = { type: "closed" };
//     return query;
//   }

//   private startQuery(): number {
//     if (this.state.type === "executing") {
//       throw new Error("Iteration can only begin on a query once.");
//     }
//     if (this.state.type === "closed" || this.state.type === "consumed") {
//       throwClosedError(this.state.type);
//     }
//     const query = this.state.query;
//     const { queryId } = performSyscall("1.0/queryStream", { query, version });
//     this.state = { type: "executing", queryId };
//     return queryId;
//   }

//   private closeQuery() {
//     if (this.state.type === "executing") {
//       const queryId = this.state.queryId;
//       performSyscall("1.0/queryCleanup", { queryId });
//     }
//     this.state = { type: "consumed" };
//   }

//   where<K extends TableInfo["fieldPaths"]>(
//     field: K,
//     op: FirebaseFirestore.WhereFilterOp,
//     value: unknown
//   ): this {
//     this._whereClauses.push({ field: field as string, op, value });
//     return this;
//   }

//   order<K extends TableInfo["fieldPaths"]>(field: K, order: "asc" | "desc" = "asc"): this {
//     this._orderBy.push({ field: field as string, order });
//     return this;
//   }

//   limit(count: number): this {
//     this._limitCount = count;
//     return this;
//   }

//   [Symbol.asyncIterator](): AsyncIterableIterator<any> {
//     this.startQuery();
//     return this;
//   }

//   async next(): Promise<IteratorResult<any>> {
//     if (this.state.type === "closed" || this.state.type === "consumed") {
//       throwClosedError(this.state.type);
//     }
//     // Allow calling `.next()` when the query is in "preparing" state to implicitly start the
//     // query. This allows the developer to call `.next()` on the query without having to use
//     // a `for await` statement.
//     const queryId = this.state.type === "preparing" ? this.startQuery() : this.state.queryId;
//     const { value, done } = await performAsyncSyscall("1.0/queryStreamNext", {
//       queryId,
//     });
//     if (done) {
//       this.closeQuery();
//     }
//     const convexValue = jsonToConvex(value);
//     return { value: convexValue, done };
//   }

//   return() {
//     this.closeQuery();
//     return Promise.resolve({ done: true, value: undefined });
//   }

//   async collect(): Promise<Array<TableInfo["document"]>> {
//     let query: FirebaseFirestore.Query = this.transaction.collection(this.collectionPath);

//     for (const clause of this._whereClauses) {
//       query = query.where(clause.field, clause.op, clause.value);
//     }

//     for (const order of this._orderBy) {
//       query = query.orderBy(order.field, order.order);
//     }

//     if (this._limitCount !== undefined) {
//       query = query.limit(this._limitCount);
//     }

//     const snapshot = await query.get();
//     return snapshot.docs.map((doc) => this.documentToData(doc));
//   }

//   async first(): Promise<TableInfo["document"] | null> {
//     const results = await this.limit(1).collect();
//     return results[0] ?? null;
//   }

//   async take(n: number): Promise<Array<TableInfo["document"]>> {
//     validateArg(n, 1, "take", "n");
//     validateArgIsNonNegativeInteger(n, 1, "take", "n");
//     return this.limit(n).collect();
//   }

//   /**
//    * Execute the query and return the singular result if there is one.
//    *
//    * @returns - The single result returned from the query or null if none exists.
//    * @throws  Will throw an error if the query returns more than one result.
//    */
//   async unique(): Promise<TableInfo["document"] | null> {
//     const results = await this.limit(1).collect();
//     if (results.length > 1) {
//       throw new Error(
//         `unique() query returned more than one result from table ${this.collectionPath}`
//       );
//     }

//     return results[0] ?? null;
//   }

//   private documentToData(doc: DocumentSnapshot<TableInfo["document"]>): TableInfo["document"] {
//     const data = doc.data();
//     if (!data) {
//       throw new Error(`Document ${doc.id} has no data`);
//     }

//     return {
//       ...data,
//       _id: `${this.collectionPath}|${doc.id}` as GenericId<string>,
//       _creationTime: data._creationTime || Date.now(),
//     } satisfies TableInfo["document"];
//   }
// }
