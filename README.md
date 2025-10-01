# Firestore Convex Style SDK

[![JSR](https://jsr.io/badges/@smartbill/firestore-convex-style)](https://jsr.io/@smartbill/firestore-convex-style)
[![JSR Score](https://jsr.io/badges/@smartbill/firestore-convex-style/score)](https://jsr.io/@smartbill/firestore-convex-style)

A TypeScript library that brings Convex's elegant schema definition and type-safe querying API to Firestore.

## Features

- 🎯 **Type-safe schemas** - Define your data model with full TypeScript support
- 🔍 **Type-safe queries** - Compile-time type checking for all database operations
- ✅ **Runtime validation** - Automatic validation using Valibot
- 🎨 **Convex-like API** - Familiar API if you've used Convex
- 🔥 **Firestore-powered** - Built on top of Firebase Admin SDK

## Installation

Install from JSR (JavaScript Registry):

```bash
# npm
npx jsr add @smartbill/firestore-convex-style

# pnpm
pnpm dlx jsr add @smartbill/firestore-convex-style

# yarn
yarn dlx jsr add @smartbill/firestore-convex-style

# deno
deno add @smartbill/firestore-convex-style

# bun
bunx jsr add @smartbill/firestore-convex-style
```

You'll also need to install the peer dependencies:

```bash
# npm
npm install valibot firebase-admin

# pnpm
pnpm add valibot firebase-admin

# yarn
yarn add valibot firebase-admin

# deno
deno add npm:valibot npm:firebase-admin

# bun
bun add valibot firebase-admin
```

## Quick Start

### 1. Define Your Schema

```typescript
import { defineSchema, defineTable, v } from '@smartbill/firestore-convex-style';

export const schema = defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    age: v.optional(v.number()),
  }).index("by_email", ["email"]),

  customers: defineTable({
    userId: v.id("users"),
    name: v.string(),
    email: v.optional(v.string()),
    taxId: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    contactName: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_name", ["userId", "name"]),
});

export type DataModel = ExtractDataModel<typeof schema>;
```

### 2. Create Queries and Mutations

```typescript
import { internalQuery, internalMutation, v } from '@smartbill/firestore-convex-style';

// Type-safe query
export const getCustomerById = internalQuery({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("Customer not found");
    return customer;
  }
});

// Type-safe mutation
export const createCustomer = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const customerId = await ctx.db.insert("customers", {
      userId: args.userId,
      name: args.name,
      email: args.email,
    });
    return customerId;
  }
});

// Query with filters
export const getCustomersByUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const customers = await ctx.db
      .query("customers")
      .where("userId", "==", args.userId)
      .order("name", "asc")
      .collect();
    return customers;
  }
});
```

### 3. Execute Functions

```typescript
import admin from 'firebase-admin';
import { FunctionRunner } from '@smartbill/firestore-convex-style';
import { schema } from './schema';
import { getCustomerById, createCustomer } from './functions';

// Initialize Firebase Admin
admin.initializeApp();
const firestore = admin.firestore();

// Create function runner
const runner = new FunctionRunner(firestore, schema);

// Run queries and mutations
async function example() {
  // Create a customer
  const customerId = await runner.runMutation(createCustomer, {
    userId: "users:abc123",
    name: "Acme Corp",
    email: "contact@acme.com",
  });

  // Get the customer
  const customer = await runner.runQuery(getCustomerById, {
    customerId,
  });

  console.log(customer);
}
```

## API Reference

### Validators

All validators are available under the `v` namespace:

- `v.string()` - String type
- `v.number()` - Number type
- `v.boolean()` - Boolean type
- `v.id(tableName)` - Document ID reference to another table
- `v.optional(validator)` - Makes a field optional
- `v.array(validator)` - Array of items
- `v.object({ ... })` - Nested object
- `v.literal(value)` - Literal value
- `v.union(v1, v2, ...)` - Union of types

### Schema Definition

```typescript
defineSchema({
  tableName: defineTable({
    field1: v.string(),
    field2: v.optional(v.number()),
  }).index("indexName", ["field1", "field2"])
})
```

### Database Operations

#### Reading Data

```typescript
// Get by ID
const doc = await ctx.db.get(documentId);

// Query with filters
const docs = await ctx.db
  .query("tableName")
  .where("field", "==", value)
  .order("field", "asc")
  .limit(10)
  .collect();

// Get first result
const firstDoc = await ctx.db
  .query("tableName")
  .where("field", "==", value)
  .first();
```

#### Writing Data

```typescript
// Insert
const id = await ctx.db.insert("tableName", { field: value });

// Update (partial)
await ctx.db.patch(documentId, { field: newValue });

// Replace (full)
await ctx.db.replace(documentId, { field: value });

// Delete
await ctx.db.delete(documentId);
```

## Type Safety

All operations are fully type-safe:

- ✅ Field names are autocompleted
- ✅ Field types are checked at compile time
- ✅ Invalid table names cause type errors
- ✅ ID references validate table names
- ✅ Query results have the correct types

## How It Differs from Convex

While inspired by Convex, this library adapts to Firestore's architecture:

1. **IDs**: Document IDs are stored as `"tableName:docId"` to preserve type information
2. **Indexes**: Index definitions are for documentation; you must create them in Firestore Console
3. **Metadata**: Documents include `_id` and `_creationTime` fields
4. **Queries**: Uses Firestore's query operators (`==`, `<`, `>`, etc.)

## License

MIT


