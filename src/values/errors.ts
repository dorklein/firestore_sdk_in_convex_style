import { Value, stringifyValueForError } from "./value.js";

const IDENTIFYING_FIELD = Symbol.for("FirestoreConvexStyleError");

export class FirestoreConvexStyleError<TData extends Value> extends Error {
  name = "FirestoreConvexStyleError";
  data: TData;
  [IDENTIFYING_FIELD] = true;

  constructor(data: TData) {
    super(typeof data === "string" ? data : stringifyValueForError(data));
    this.data = data;
  }
}
