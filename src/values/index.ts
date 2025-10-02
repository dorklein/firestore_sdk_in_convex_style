export type { Id as GenericId, JSONValue, Value, NumericValue } from "./value.js";
export { convexToJson, jsonToConvex } from "./value.js";
export { v, asObjectValidator } from "./validator.js";
export type {
  AsObjectValidator,
  GenericValidator,
  ObjectType,
  PropertyValidators,
} from "./validator.js";
export type {
  ValidatorJSON,
  RecordKeyValidatorJSON,
  RecordValueValidatorJSON,
  ObjectFieldType,
  Validator,
  OptionalProperty,
  VId,
  VFloat64,
  VInt64,
  VBoolean,
  VBytes,
  VString,
  VNull,
  VAny,
  VObject,
  VLiteral,
  VArray,
  VRecord,
  VUnion,
  VOptional,
} from "./validators.js";
export type { Infer } from "./validator.js";

export { FirestoreConvexStyleError } from "./errors.js";
