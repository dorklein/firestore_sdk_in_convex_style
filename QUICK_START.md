# Quick Start Guide

Get up and running with Firestore Convex Style SDK in 5 minutes! ⚡

## 1. Define Your Schema (2 min)

Create `schema.ts`:

```typescript
import { defineSchema, defineTable, v } from './src/index.js';

export const schema = defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    age: v.optional(v.number()),
  }),
  
  posts: defineTable({
    userId: v.id("users"),
    title: v.string(),
    content: v.string(),
    published: v.boolean(),
  }),
});
```

## 2. Generate Types (30 sec)

```bash
# One-time generation
pnpm codegen

# Or watch mode for development
pnpm codegen:watch
```

This creates `_generated/` with:
- `schema.ts` - Re-exported schema
- `dataModel.ts` - Types (`Id<T>`, `Doc<T>`, `DataModel`)
- `server.ts` - Typed query/mutation builders

## 3. Write Functions (2 min)

Create `functions.ts`:

```typescript
import { internalQuery, internalMutation } from "./_generated/server.js";
import { v } from "./src/index.js";

// Query - fully typed!
export const getUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
    // Returns: Doc<"users"> | null
  },
});

// Mutation - runs in transaction!
export const createPost = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Type-safe insert
    const postId = await ctx.db.insert("posts", {
      userId: args.userId,
      title: args.title,
      content: args.content,
      published: false,
    });
    return postId;
  },
});

// Query with filtering
export const getUserPosts = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // Type-safe query
    return await ctx.db
      .query("posts")
      .where("userId", "==", args.userId)
      .where("published", "==", true)
      .order("_creationTime", "desc")
      .collect();
  },
});
```

## 4. Run Your Functions (30 sec)

Use the `FunctionRunner` to execute your queries and mutations:

```typescript
import * as admin from "firebase-admin";
import { createFunctionRunner } from "./src/functions.js";
import { schema } from "./schema.js";
import { createUser, getUserById } from "./functions.js";

// Initialize Firebase
admin.initializeApp();
const firestore = admin.firestore();

// Create function runner
const runner = createFunctionRunner(firestore, schema);

// Run a mutation
const userId = await runner.runMutation(createUser, {
  name: "Alice",
  email: "alice@example.com",
  role: "user",
  age: 30,
});

// Run a query
const user = await runner.runQuery(getUserById, { userId });
console.log(user); // Fully typed!
```

## 5. Enjoy Type Safety! ✨

You now have:

✅ Table name autocomplete  
✅ Field name autocomplete  
✅ Type checking on inserts/updates  
✅ Strongly typed query results  
✅ ID type safety (can't mix user IDs with post IDs)  
✅ Compile-time error checking  
✅ Transaction support (mutations auto-run in transactions)  

## Common Operations

### Read a Document
```typescript
const user = await ctx.db.get(userId);
// Type: Doc<"users"> | null
```

### Query with Filters
```typescript
const posts = await ctx.db
  .query("posts")
  .where("published", "==", true)
  .order("_creationTime", "desc")
  .limit(10)
  .collect();
```

### Insert a Document
```typescript
const id = await ctx.db.insert("users", {
  name: "Alice",
  email: "alice@example.com",
  age: 30,
});
```

### Update a Document (Partial)
```typescript
await ctx.db.patch(userId, {
  age: 31,
});
```

### Replace a Document (Full)
```typescript
await ctx.db.replace(userId, {
  name: "Alice",
  email: "alice@example.com",
  age: 31,
});
```

### Delete a Document
```typescript
await ctx.db.delete(userId);
```

## Type Utilities

```typescript
import type { Id, Doc, DataModel } from "./_generated/dataModel.js";

// ID types
type UserId = Id<"users">;
type PostId = Id<"posts">;

// Document types
type User = Doc<"users">;
type Post = Doc<"posts">;

// Full data model
type MyDataModel = DataModel;
```

## Workflow

```bash
# 1. Edit schema.ts
vim schema.ts

# 2. Regenerate types (or use watch mode)
pnpm codegen

# 3. Write functions with full type safety
vim functions.ts

# 4. Execute functions with the runner
# See examples/usage.ts for complete example

# Done! 🎉
```

## Function Runner

The `FunctionRunner` executes your queries and mutations with:

✅ **Argument validation** - Type-safe arguments  
✅ **Transaction support** - Mutations run in Firestore transactions  
✅ **Automatic rollback** - Errors trigger transaction rollback  
✅ **Nested function calls** - Call queries from within mutations  

```typescript
import { createFunctionRunner } from "./src/functions.js";

const runner = createFunctionRunner(firestore, schema);

// Queries - read-only operations
const result = await runner.runQuery(myQuery, { arg: value });

// Mutations - write operations (run in transactions)
const id = await runner.runMutation(myMutation, { arg: value });
```

## Watch Mode (Recommended)

Run this in a separate terminal during development:

```bash
pnpm codegen:watch
```

Types will regenerate automatically when you change your schema!

## Commands Cheat Sheet

```bash
# Generate types once
pnpm codegen

# Watch mode (auto-regenerate)
pnpm codegen:watch

# Generate for specific schema
pnpm codegen --schema examples/schema.ts

# Or use tsx directly
npx tsx src/cli/dev.ts
npx tsx src/cli/dev.ts --watch
npx tsx src/cli/dev.ts --schema path/to/schema.ts
```

## Example Project Structure

```
my-project/
├── schema.ts               # Your schema definition
├── _generated/            # Generated types (git ignore)
│   ├── schema.ts
│   ├── dataModel.ts
│   └── server.ts
├── functions.ts           # Your query/mutation functions
└── package.json
```

## Need More Help?

📘 **[CODEGEN_GUIDE.md](./CODEGEN_GUIDE.md)** - Detailed code generation guide  
📘 **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Technical details  
📘 **[examples/](./examples/)** - Full working examples  

## That's It! 🚀

You're ready to build type-safe Firestore apps with a Convex-like developer experience!

Happy coding! 💙

