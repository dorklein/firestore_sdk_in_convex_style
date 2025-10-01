# Function Runner Guide

The `FunctionRunner` is the runtime executor for your Convex-style queries and mutations. It provides a type-safe way to execute your functions with automatic transaction handling.

## Quick Start

```typescript
import * as admin from "firebase-admin";
import { createFunctionRunner } from "./src/functions.js";
import { schema } from "./schema.js";

// Initialize Firebase
admin.initializeApp();
const firestore = admin.firestore();

// Create function runner
const runner = createFunctionRunner(firestore, schema);

// Run queries and mutations!
const user = await runner.runQuery(getUserById, { userId: "users|123" });
const newId = await runner.runMutation(createUser, { name: "Alice", email: "alice@example.com" });
```

## Features

### ✅ Type-Safe Execution

All function calls are fully type-checked:

```typescript
// ✅ Correct usage
await runner.runQuery(getUserById, {
  userId: "users|123" as Id<"users">
});

// ❌ Type error - wrong argument type
await runner.runQuery(getUserById, {
  userId: 123 // Error: number is not assignable to Id<"users">
});

// ❌ Type error - missing required argument
await runner.runQuery(getUserById, {}); // Error: userId is required
```

### ✅ Automatic Transactions

Mutations automatically run inside Firestore transactions:

```typescript
export const transferMoney = internalMutation({
  args: {
    fromAccount: v.id("accounts"),
    toAccount: v.id("accounts"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    // All these operations run in a single transaction
    const from = await ctx.db.get(args.fromAccount);
    const to = await ctx.db.get(args.toAccount);
    
    if (from.balance < args.amount) {
      throw new Error("Insufficient funds"); // Transaction will rollback
    }
    
    await ctx.db.patch(args.fromAccount, {
      balance: from.balance - args.amount
    });
    
    await ctx.db.patch(args.toAccount, {
      balance: to.balance + args.amount
    });
    
    return { success: true };
  },
});

// Execute - everything happens atomically
await runner.runMutation(transferMoney, {
  fromAccount: "accounts|alice" as Id<"accounts">,
  toAccount: "accounts|bob" as Id<"accounts">,
  amount: 100,
});
```

### ✅ Automatic Rollback

If any error occurs during a mutation, the entire transaction is rolled back:

```typescript
try {
  await runner.runMutation(createUser, {
    name: "Invalid User",
    email: "bad-email", // This might cause an error
  });
} catch (error) {
  // Transaction was rolled back - no partial writes!
  console.error("Error:", error.message);
}
```

### ✅ Nested Function Calls

Call queries from within mutations:

```typescript
export const createOrder = internalMutation({
  args: {
    userId: v.id("users"),
    items: v.array(v.object({
      productId: v.id("products"),
      quantity: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    // Call a query from within a mutation
    const user = await ctx.runQuery(getUserById, {
      userId: args.userId
    });
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Create the order
    const orderId = await ctx.db.insert("orders", {
      userId: args.userId,
      items: args.items,
      status: "pending",
      createdAt: Date.now(),
    });
    
    return orderId;
  },
});
```

## API Reference

### `createFunctionRunner(firestore, schema)`

Creates a new function runner instance.

**Parameters:**
- `firestore: Firestore` - The Firestore instance
- `schema: SchemaDefinition` - Your schema definition

**Returns:** `FunctionRunner<DataModel>`

**Example:**
```typescript
const runner = createFunctionRunner(firestore, schema);
```

### `runner.runQuery(query, args)`

Execute a query function.

**Parameters:**
- `query: RegisteredQuery` - The query function (from `internalQuery` or `query`)
- `args: Args` - The arguments object (fully typed)

**Returns:** `Promise<ReturnType>` - The query result (fully typed)

**Example:**
```typescript
const user = await runner.runQuery(getUserById, {
  userId: "users|123" as Id<"users">
});
// user is typed as Doc<"users"> | null
```

### `runner.runMutation(mutation, args)`

Execute a mutation function inside a Firestore transaction.

**Parameters:**
- `mutation: RegisteredMutation` - The mutation function (from `internalMutation` or `mutation`)
- `args: Args` - The arguments object (fully typed)

**Returns:** `Promise<ReturnType>` - The mutation result (fully typed)

**Example:**
```typescript
const userId = await runner.runMutation(createUser, {
  name: "Alice",
  email: "alice@example.com",
  role: "user",
});
// userId is typed as Id<"users">
```

### `runner.getFirestore()`

Get the underlying Firestore instance.

**Returns:** `Firestore`

### `runner.getSchema()`

Get the schema definition.

**Returns:** `SchemaDefinition`

## Complete Example

```typescript
import * as admin from "firebase-admin";
import { createFunctionRunner } from "./src/functions.js";
import { schema } from "./schema.js";
import { internalQuery, internalMutation } from "./_generated/server.js";
import { v } from "./src/index.js";

// Initialize Firebase
admin.initializeApp();
const firestore = admin.firestore();

// Create runner
const runner = createFunctionRunner(firestore, schema);

// Define functions
export const getUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const createUser = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      createdAt: Date.now(),
    });
  },
});

// Use the runner
async function main() {
  // Create a user
  const userId = await runner.runMutation(createUser, {
    name: "Alice",
    email: "alice@example.com",
  });
  console.log("Created user:", userId);

  // Get the user
  const user = await runner.runQuery(getUser, { userId });
  console.log("User:", user);
}

main().catch(console.error);
```

## Error Handling

### Query Errors

```typescript
try {
  const user = await runner.runQuery(getUserById, {
    userId: "users|invalid" as Id<"users">
  });
} catch (error) {
  console.error("Query failed:", error.message);
}
```

### Mutation Errors (with Rollback)

```typescript
try {
  await runner.runMutation(createOrder, {
    userId: "users|123" as Id<"users">,
    items: [],
  });
} catch (error) {
  // All database changes in this mutation were rolled back
  console.error("Mutation failed:", error.message);
}
```

## Best Practices

### 1. Use Descriptive Function Names

```typescript
// ✅ Good
export const getUsersByRole = internalQuery({ ... });
export const updateUserEmail = internalMutation({ ... });

// ❌ Bad
export const get = internalQuery({ ... });
export const update = internalMutation({ ... });
```

### 2. Validate Input in Handlers

```typescript
export const createUser = internalMutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate email format
    if (!args.email.includes("@")) {
      throw new Error("Invalid email format");
    }
    
    // Check for duplicates
    const existing = await ctx.db
      .query("users")
      .where("email", "==", args.email)
      .first();
      
    if (existing) {
      throw new Error("Email already exists");
    }
    
    return await ctx.db.insert("users", {
      email: args.email,
      createdAt: Date.now(),
    });
  },
});
```

### 3. Use Transactions for Related Updates

```typescript
// ✅ Good - All updates in one transaction
export const completeOrder = internalMutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, { status: "completed" });
    // Update inventory, send notification, etc. - all atomic
  },
});

// ❌ Bad - Separate operations can fail independently
async function completeOrderBad(orderId: Id<"orders">) {
  await runner.runMutation(updateOrderStatus, { orderId, status: "completed" });
  await runner.runMutation(updateInventory, { orderId });
  await runner.runMutation(sendNotification, { orderId });
}
```

### 4. Return Useful Data

```typescript
// ✅ Good - Returns the created ID
export const createUser = internalMutation({
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert("users", { ... });
    return userId;
  },
});

// ✅ Also good - Returns the full object
export const createUser = internalMutation({
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert("users", { ... });
    const user = await ctx.db.get(userId);
    return user;
  },
});
```

## Comparison with Direct Firestore Usage

| Feature | FunctionRunner | Direct Firestore |
|---------|----------------|------------------|
| Type Safety | ✅ Full | ❌ Minimal |
| Transactions | ✅ Automatic | 🟡 Manual |
| Rollback | ✅ Automatic | 🟡 Manual |
| Argument Validation | ✅ Built-in | ❌ Manual |
| Code Reuse | ✅ Easy | 🟡 Harder |
| Testing | ✅ Easy to mock | 🟡 Harder |

## Summary

The `FunctionRunner` provides:

✅ **Type-safe execution** - Catch errors at compile time  
✅ **Automatic transactions** - Mutations are atomic  
✅ **Automatic rollback** - Errors trigger rollback  
✅ **Nested calls** - Call queries from mutations  
✅ **Clean API** - Simple and intuitive  

Use it to execute your Convex-style functions with confidence! 🚀

