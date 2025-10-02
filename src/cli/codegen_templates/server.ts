import { header } from "./common.ts";

export function serverCodegen() {
  const serverDTS = `
    ${header(
      "Generated utilities for implementing server-side Convex query and mutation functions."
    )}
    import type {
        GenericQueryCtx,
        GenericMutationCtx,
        QueryBuilder,
        MutationBuilder,
    } from "@smartbill/firestore-convex-style/server";
    import type { DataModel } from "./dataModel.js";

    /**
     * Define a query in this Convex app's public API.
     *
     * This function will be allowed to read your Convex database and will be accessible from the client.
     *
     * @param func - The query function. It receives a {@link QueryCtx} as its first argument.
     * @returns The wrapped query. Include this as an \`export\` to name it and make it accessible.
     */
    export const query: QueryBuilder<DataModel, "public">;

    /**
     * Define a query that is only accessible from other Convex functions (but not from the client).
     *
     * This function will be allowed to read from your Convex database. It will not be accessible from the client.
     *
     * @param func - The query function. It receives a {@link QueryCtx} as its first argument.
     * @returns The wrapped query. Include this as an \`export\` to name it and make it accessible.
     */
    export const internalQuery: QueryBuilder<DataModel, "internal">;

    /**
     * Define a mutation in this Convex app's public API.
     *
     * This function will be allowed to modify your Convex database and will be accessible from the client.
     *
     * @param func - The mutation function. It receives a {@link MutationCtx} as its first argument.
     * @returns The wrapped mutation. Include this as an \`export\` to name it and make it accessible.
     */
    export const mutation: MutationBuilder<DataModel, "public">;

    /**
     * Define a mutation that is only accessible from other Convex functions (but not from the client).
     *
     * This function will be allowed to modify your Convex database. It will not be accessible from the client.
     *
     * @param func - The mutation function. It receives a {@link MutationCtx} as its first argument.
     * @returns The wrapped mutation. Include this as an \`export\` to name it and make it accessible.
     */
    export const internalMutation: MutationBuilder<DataModel, "internal">;

    /**
     * A set of services for use within Convex query functions.
     *
     * The query context is passed as the first argument to any Convex query
     * function run on the server.
     *
     * This differs from the {@link MutationCtx} because all of the services are
     * read-only.
     */
    export type QueryCtx = GenericQueryCtx<DataModel>;

    /**
     * A set of services for use within Convex mutation functions.
     *
     * The mutation context is passed as the first argument to any Convex mutation
     * function run on the server.
     */
    export type MutationCtx = GenericMutationCtx<DataModel>;`;

  const serverJS = `
    ${header(
      "Generated utilities for implementing server-side Convex query and mutation functions."
    )}
    import {
      queryGeneric,
      mutationGeneric,
      internalMutationGeneric,
      internalQueryGeneric,
    } from "@smartbill/firestore-convex-style/server";

    /**
     * Define a query in this Firestore app's public API.
     *
     * This function will be allowed to read your Convex database and will be accessible from the client.
     *
     * @param func - The query function. It receives a {@link QueryCtx} as its first argument.
     * @returns The wrapped query. Include this as an \`export\` to name it and make it accessible.
     */
    export const query = queryGeneric;

    /**
     * Define a query that is only accessible from other Firestore functions (but not from the client).
     *
     * This function will be allowed to read from your Convex database. It will not be accessible from the client.
     *
     * @param func - The query function. It receives a {@link QueryCtx} as its first argument.
     * @returns The wrapped query. Include this as an \`export\` to name it and make it accessible.
     */
    export const internalQuery = internalQueryGeneric;

    /**
     * Define a mutation in this Firestore app's public API.
     *
     * This function will be allowed to modify your Convex database and will be accessible from the client.
     *
     * @param func - The mutation function. It receives a {@link MutationCtx} as its first argument.
     * @returns The wrapped mutation. Include this as an \`export\` to name it and make it accessible.
     */
    export const mutation = mutationGeneric;

    /**
     * Define a mutation that is only accessible from other Firestore functions (but not from the client).
     *
     * This function will be allowed to modify your Convex database. It will not be accessible from the client.
     *
     * @param func - The mutation function. It receives a {@link MutationCtx} as its first argument.
     * @returns The wrapped mutation. Include this as an \`export\` to name it and make it accessible.
     */
    export const internalMutation = internalMutationGeneric;`;

  return {
    DTS: serverDTS,
    JS: serverJS,
  };
}
