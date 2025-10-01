# Code Generation Guide

This library provides Convex-style code generation to create strongly-typed TypeScript files from your schema definitions.

## Quick Start

### 1. Define Your Schema

Create a `schema.ts` file with your database schema:

```typescript
// examples/schema.ts or src/schema.ts
import { defineSchema, defineTable, v } from '@smartbill/firestore-convex-style';

export const schema = defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    age: v.optional(v.number()),
    createdAt: v.number(),
  }),
  
  customers: defineTable({
    userId: v.id("users"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  }),
});
```

### 2. Run Code Generation

Generate TypeScript types from your schema:

```bash
# Using npm scripts
pnpm codegen
# or
pnpm codegen --schema examples/schema.ts

# Or run directly with tsx
npx tsx src/cli/dev.ts
# or
npx tsx src/cli/dev.ts --schema examples/schema.ts
```

### 3. Watch Mode (Recommended for Development)

Run in watch mode to automatically regenerate types when your schema changes:

```bash
pnpm codegen:watch
# or
npx tsx src/cli/dev.ts --watch
```

## Generated Files

The code generator creates a `_generated` directory next to your schema file with three files:

### `_generated/schema.ts`
Re-exports your schema for use by the type system.

### `_generated/dataModel.ts`
Provides strongly-typed references to your data:

```typescript
import type { DataModel, Doc, Id } from "./_generated/dataModel.js";

// Doc<"users"> gives you the full type of a users document
type UserDoc = Doc<"users">;

// Id<"users"> gives you a strongly-typed ID for users
type UserId = Id<"users">;

// DataModel gives you the entire data model structure
type MyDataModel = DataModel;
```

### `_generated/server.ts`
Provides strongly-typed query and mutation builders:

```typescript
import { internalQuery, internalMutation } from "./_generated/server.js";
import { v } from "../src/index.js";

export const getUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // ctx.db is fully typed!
    // args.userId is typed as Id<"users">
    const user = await ctx.db.get(args.userId);
    // user is typed as Doc<"users"> | null
    return user;
  },
});

export const createUser = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    age: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Insert is fully typed - you can't insert invalid fields!
    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      age: args.age,
      role: "user", // Literal type is enforced
      createdAt: Date.now(),
    });
    return userId;
  },
});
```

## Type Safety Benefits

The generated types provide:

✅ **Table name autocomplete** - `ctx.db.query("users")` autocompletes table names  
✅ **Field type checking** - Can't insert wrong types into documents  
✅ **Field name autocomplete** - `.where("name", "==", ...)` autocompletes field names  
✅ **ID type safety** - `v.id("users")` creates a type-safe user ID  
✅ **Document type inference** - Query results are automatically typed  
✅ **Compile-time errors** - Catch errors before runtime  

## Comparison to Convex

This is similar to running `npx convex dev` which generates types in Convex projects.

| Convex | Firestore Convex Style |
|--------|------------------------|
| `npx convex dev` | `pnpm codegen` or `npx tsx src/cli/dev.ts` |
| `convex/_generated/` | `[schema-dir]/_generated/` |
| `api.ts` generated | `server.ts` generated |
| `dataModel.d.ts` | `dataModel.ts` |

## Usage in Your Project

After generating types, use them in your function definitions:

```typescript
// Import from _generated
import { internalQuery, internalMutation, type QueryCtx, type MutationCtx } from "./_generated/server.js";
import type { Id, Doc } from "./_generated/dataModel.js";
import { v } from "../src/index.js";

// Use the generated types
export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// Helper functions can use the generated context types
async function findUserByEmail(ctx: QueryCtx, email: string): Promise<Doc<"users"> | null> {
  const users = await ctx.db
    .query("users")
    .where("email", "==", email)
    .first();
  return users;
}
```

## Workflow

1. **Define schema** in `schema.ts`
2. **Run `pnpm codegen`** to generate types
3. **Import from `_generated/server.js`** in your functions
4. **Enjoy type safety!** 🎉

## Troubleshooting

### "Cannot find module './_generated/...'"

Make sure you've run the code generation:
```bash
pnpm codegen
```

### Wrong import paths in generated files

The generator automatically detects whether you're in a `src/` or `examples/` directory and adjusts import paths. If you have a custom directory structure, you may need to adjust the imports manually.

### Schema changes not reflected

If running in watch mode (`--watch`), the types should update automatically. Otherwise, run `pnpm codegen` again after changing your schema.

## Advanced

### Multiple Schemas

You can generate types for multiple schemas in different directories:

```bash
# Generate for examples
npx tsx src/cli/dev.ts --schema examples/schema.ts

# Generate for src  
npx tsx src/cli/dev.ts --schema src/schema.ts

# Generate for a custom location
npx tsx src/cli/dev.ts --schema custom/path/to/schema.ts
```

### CI/CD Integration

Add type generation to your CI pipeline:

```yaml
# .github/workflows/ci.yml
- name: Generate types
  run: pnpm codegen

- name: Type check
  run: pnpm tsc --noEmit
```

## Summary

The code generator transforms your schema into strongly-typed TypeScript files, giving you:

- 🎯 **Type-safe database operations**
- 🔍 **Autocomplete everywhere**
- ✅ **Compile-time error checking**
- 📚 **Self-documenting code**
- 🚀 **Better developer experience**

Just like Convex, but for Firestore! 🔥

