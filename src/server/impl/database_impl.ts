import { GenericId } from "../../values/index.js";
import {
  GenericDatabaseReader,
  GenericDatabaseReaderWithTable,
  GenericDatabaseWriter,
  GenericDatabaseWriterWithTable,
} from "../database.js";
import { createId, QueryImpl } from "./query_impl.js";
import { GenericDataModel, GenericDocument } from "../data_model.js";
import { validateArg } from "./validate.js";
import { DocumentSnapshot, Firestore, getFirestore } from "firebase-admin/firestore";

/** in the future, we might handle this with projectId etc... */
export const getDefaultDB = () => getFirestore();

function documentToData(doc: DocumentSnapshot): GenericDocument {
  const data = doc.data();
  if (!data) {
    throw new Error(`Document ${doc.id} has no data`);
  }

  const tableName = doc.ref.collection.name;
  return {
    ...data,
    _id: createId(tableName, doc.id),
    _creationTime: data._creationTime || Date.now(),
  } satisfies GenericDocument;
}

async function get(db: Firestore, table: string, id: GenericId<string>) {
  // If the user doesn’t provide any arguments, we use the new signature in the error message.
  // We don’t do argument validation on the table argument since it’s not provided when using the old signature.
  validateArg(id, 1, "get", "id");
  if (typeof id !== "string") {
    throw new Error(
      `Invalid argument \`id\` for \`db.get\`, expected string but got '${typeof id}': ${id as any}`
    );
  }
  //   const args = {
  //     id: convexToJson(id),
  //     isSystem,
  //     version,
  //     table,
  //   };
  //   const syscallJSON = await performAsyncSyscall("1.0/get", args);

  const snapshot = await db.collection(table).doc(id).get();
  return documentToData(snapshot);

  //   return jsonToConvex(syscallJSON) as GenericDocument;
}

export function setupReader(db: Firestore): GenericDatabaseReader<GenericDataModel> {
  const reader = (
    isSystem = false
  ): GenericDatabaseReader<GenericDataModel> & GenericDatabaseReaderWithTable<GenericDataModel> => {
    return {
      get: async (id: GenericId<string>) => {
        const table = id.split("|")[0];
        return await get(db, table, id);
      },
      query: (tableName: string) => {
        return new TableReader(tableName, isSystem, db).query();
      },
      normalizeId: <TableName extends string>(
        tableName: TableName,
        id: string
      ): GenericId<TableName> | null => {
        validateArg(tableName, 1, "normalizeId", "tableName");
        validateArg(id, 2, "normalizeId", "id");
        const accessingSystemTable = tableName.startsWith("_");
        if (accessingSystemTable !== isSystem) {
          throw new Error(
            `${accessingSystemTable ? "System" : "User"} tables can only be accessed from db.${
              isSystem ? "" : "system."
            }normalizeId().`
          );
        }
        throw new Error("Not implemented");
        // const syscallJSON = performSyscall("1.0/db/normalizeId", {
        //   table: tableName,
        //   idString: id,
        // });
        // const syscallResult = jsonToConvex(syscallJSON) as any;
        // return syscallResult.id;
      },
      // We set the system reader on the next line
      system: null as any,
      table: (tableName) => {
        return new TableReader(tableName, isSystem, db);
      },
    };
  };
  const { system: _, ...rest } = reader(true);
  const r = reader();
  r.system = rest as any;
  return r;
}

async function insert<TableName extends string>(
  db: Firestore,
  tableName: TableName,
  value: any
): Promise<GenericId<TableName>> {
  if (tableName.startsWith("_")) {
    throw new Error("System tables (prefixed with `_`) are read-only.");
  }
  validateArg(tableName, 1, "insert", "table");
  validateArg(value, 2, "insert", "value");
  //   const syscallJSON = await performAsyncSyscall("1.0/insert", {
  //     table: tableName,
  //     value: convexToJson(value),
  //   });
  //   const syscallResult = jsonToConvex(syscallJSON) as any;
  //   return syscallResult._id;

  const baseId = db.collection(tableName).doc().id;
  const docId = createId(tableName, baseId);
  const dataWithSystemFields = {
    ...value,
    _id: docId,
    _creationTime: Date.now(),
  } satisfies GenericDocument;

  await db.collection(tableName).doc(docId).set(dataWithSystemFields);
  return docId;
}

async function patch<TableName extends string>(
  db: Firestore,
  table: TableName,
  id: GenericId<TableName>,
  value: any
) {
  validateArg(id, 1, "patch", "id");
  validateArg(value, 2, "patch", "value");
  //   await performAsyncSyscall("1.0/shallowMerge", {
  //     id: convexToJson(id),
  //     value: patchValueToJson(value as Value),
  //     table,
  //   });

  await db.collection(table).doc(id).update(value);
}

async function replace(db: Firestore, table: string, id: GenericId<string>, value: any) {
  validateArg(id, 1, "replace", "id");
  validateArg(value, 2, "replace", "value");
  //   await performAsyncSyscall("1.0/replace", {
  //     id: convexToJson(id),
  //     value: convexToJson(value),
  //     table,
  //   });

  await db.collection(table).doc(id).set(value);
}

async function delete_(db: Firestore, table: string, id: GenericId<string>) {
  validateArg(id, 1, "delete", "id");
  //   await performAsyncSyscall("1.0/remove", {
  //     id: convexToJson(id),
  //     table,
  //   });

  await db.collection(table).doc(id).delete();
}

export function setupWriter(
  db: Firestore
): GenericDatabaseWriter<GenericDataModel> & GenericDatabaseWriterWithTable<GenericDataModel> {
  const reader = setupReader(db);
  return {
    get: reader.get,
    query: reader.query,
    normalizeId: reader.normalizeId,
    system: reader.system as any,
    insert: async (table, value) => {
      return await insert(db, table, value);
    },
    patch: async (table, id, value) => {
      return await patch(db, table, id, value);
    },
    replace: async (table, id, value) => {
      return await replace(db, table, id, value);
    },
    delete: async (table, id) => {
      return await delete_(db, table, id);
    },
    table: (tableName) => {
      return new TableWriter(tableName, false, db) as any;
    },
  };
}
class TableReader {
  constructor(
    protected readonly tableName: string,
    protected readonly isSystem: boolean,
    protected readonly db: Firestore
  ) {}

  async get(id: GenericId<string>) {
    return get(this.db, this.tableName, id);
  }

  query() {
    const accessingSystemTable = this.tableName.startsWith("_");
    if (accessingSystemTable !== this.isSystem) {
      throw new Error(
        `${accessingSystemTable ? "System" : "User"} tables can only be accessed from db.${
          this.isSystem ? "" : "system."
        }query().`
      );
    }
    return new QueryImpl({ collectionPath: this.tableName, db: this.db });
  }
}

class TableWriter extends TableReader {
  async insert(value: any) {
    return insert(this.db, this.tableName, value);
  }
  async patch(id: any, value: any) {
    return patch(this.db, this.tableName, id, value);
  }
  async replace(id: any, value: any) {
    return replace(this.db, this.tableName, id, value);
  }
  async delete(id: any) {
    return delete_(this.db, this.tableName, id);
  }
}

// class TransactionalTableReader {
//   constructor(
//     protected readonly tableName: string,
//     protected readonly isSystem: boolean,
//     protected readonly transaction: Transaction
//   ) {}

//   async get(id: GenericId<string>) {
//     return get(this.tableName, id, this.isSystem);
//   }

//   query() {
//     const accessingSystemTable = this.tableName.startsWith("_");
//     if (accessingSystemTable !== this.isSystem) {
//       throw new Error(
//         `${accessingSystemTable ? "System" : "User"} tables can only be accessed from db.${
//           this.isSystem ? "" : "system."
//         }query().`
//       );
//     }
//     return new TransactionalQueryImpl({
//       collectionPath: this.tableName,
//       transaction: this.transaction,
//     });
//   }
// }
// class TransactionalTableWriter extends TransactionalTableReader {
//   async insert(value: any) {
//     return insert(this.tableName, value);
//   }
//   async patch(id: any, value: any) {
//     return patch(this.tableName, id, value);
//   }
//   async replace(id: any, value: any) {
//     return replace(this.tableName, id, value);
//   }
//   async delete(id: any) {
//     return delete_(this.tableName, id);
//   }
// }
