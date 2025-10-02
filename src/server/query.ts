import { DocumentByInfo, GenericTableInfo } from "./data_model.js";

/**
 * A {@link Query} with an order that has already been defined.
 *
 * @public
 */
export interface Query<TableInfo extends GenericTableInfo>
  extends AsyncIterable<DocumentByInfo<TableInfo>> {
  where<K extends TableInfo["fieldPaths"]>(
    field: K,
    op: FirebaseFirestore.WhereFilterOp,
    value: unknown
  ): this;

  /**
   * Define the order of the query output.
   *
   * Use `"asc"` for an ascending order and `"desc"` for a descending order. If not specified, the order defaults to ascending.
   * @param field - The field to order by.
   * @param order - The order to return results in.
   */
  //   order(order: "asc" | "desc"): OrderedQuery<TableInfo>;
  order<K extends TableInfo["fieldPaths"]>(field: K, order: "asc" | "desc"): this;

  /**
   * Take only the first `n` results from the pipeline so far.
   *
   * @param n - Limit for the number of results at this stage of the query pipeline.
   * @returns - A new {@link OrderedQuery} with the specified limit applied.
   *
   * @internal
   */
  limit(n: number): this;

  /**
   * Execute the query and return all of the results as an array.
   *
   * Note: when processing a query with a lot of results, it's often better to use the `Query` as an
   * `AsyncIterable` instead.
   *
   * @returns - An array of all of the query's results.
   */
  collect(): Promise<Array<DocumentByInfo<TableInfo>>>;

  /**
   * Execute the query and return the first `n` results.
   *
   * @param n - The number of items to take.
   * @returns - An array of the first `n` results of the query (or less if the
   * query doesn't have `n` results).
   */
  take(n: number): Promise<Array<DocumentByInfo<TableInfo>>>;

  /**
   * Execute the query and return the first result if there is one.
   *
   * @returns - The first value of the query or `null` if the query returned no results.
   * */
  first(): Promise<DocumentByInfo<TableInfo> | null>;

  /**
   * Execute the query and return the singular result if there is one.
   *
   * @returns - The single result returned from the query or null if none exists.
   * @throws  Will throw an error if the query returns more than one result.
   */
  unique(): Promise<DocumentByInfo<TableInfo> | null>;
}
