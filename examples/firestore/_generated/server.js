/* eslint-disable */
/**
 * Generated utilities for implementing server-side Convex query, mutation, and action functions.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx @smartbill/firestore-convex-style dev`.
 * @module
 */

import {
  queryGeneric,
  mutationGeneric,
  internalMutationGeneric,
  internalQueryGeneric,
  actionGeneric,
  internalActionGeneric,
} from "@smartbill/firestore-convex-style/server";

/**
 * Define a query in this Firestore app's public API.
 *
 * This function will be allowed to read your Convex database and will be accessible from the client.
 *
 * @param func - The query function. It receives a {@link QueryCtx} as its first argument.
 * @returns The wrapped query. Include this as an `export` to name it and make it accessible.
 */
export const query = queryGeneric;

/**
 * Define a query that is only accessible from other Firestore functions (but not from the client).
 *
 * This function will be allowed to read from your Convex database. It will not be accessible from the client.
 *
 * @param func - The query function. It receives a {@link QueryCtx} as its first argument.
 * @returns The wrapped query. Include this as an `export` to name it and make it accessible.
 */
export const internalQuery = internalQueryGeneric;

/**
 * Define a mutation in this Firestore app's public API.
 *
 * This function will be allowed to modify your Convex database and will be accessible from the client.
 *
 * @param func - The mutation function. It receives a {@link MutationCtx} as its first argument.
 * @returns The wrapped mutation. Include this as an `export` to name it and make it accessible.
 */
export const mutation = mutationGeneric;

/**
 * Define a mutation that is only accessible from other Firestore functions (but not from the client).
 *
 * This function will be allowed to modify your Convex database. It will not be accessible from the client.
 *
 * @param func - The mutation function. It receives a {@link MutationCtx} as its first argument.
 * @returns The wrapped mutation. Include this as an `export` to name it and make it accessible.
 */
export const internalMutation = internalMutationGeneric;

/**
 * Define an action in this Firestore app's public API.
 *
 * An action is a function that can perform side effects and cannot directly read or write to the database.
 * Actions must use ctx.runQuery and ctx.runMutation to interact with the database.
 *
 * @param func - The action function. It receives an {@link ActionCtx} as its first argument.
 * @returns The wrapped action. Include this as an `export` to name it and make it accessible.
 */
export const action = actionGeneric;

/**
 * Define an action that is only accessible from other Firestore functions (but not from the client).
 *
 * An action is a function that can perform side effects and cannot directly read or write to the database.
 * Actions must use ctx.runQuery and ctx.runMutation to interact with the database.
 *
 * @param func - The action function. It receives an {@link ActionCtx} as its first argument.
 * @returns The wrapped action. Include this as an `export` to name it and make it accessible.
 */
export const internalAction = internalActionGeneric;
