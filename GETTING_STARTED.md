# Getting Started

## Installation

```bash
# Install dependencies
pnpm install

# Build the library
pnpm run build
```

## Project Structure

```
firestore-convex-style/
├── src/
│   ├── index.ts          # Main entry point
│   ├── validators.ts     # Field validators (v.string(), v.id(), etc.)
│   ├── schema.ts         # Schema definition (defineSchema, defineTable)
│   ├── database.ts       # Database operations (get, query, insert, etc.)
│   └── functions.ts      # Query/mutation builders
├── examples/
│   ├── schema.ts         # Example schema definition
│   ├── functions.ts      # Example queries and mutations
│   └── usage.ts          # Example usage
└── dist/                 # Compiled output (after build)
```

## Basic Example

Here's the simplest possible example to get you started:

### 1. Define a Schema

```typescript
import { defineSchema, defineTable, v } from 'firestore-convex-style';

const schema = defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
  }),
});
```

### 2. Create a Query

```typescript
import { internalQuery, v } from 'firestore-convex-style';

const getUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  }
});
```

### 3. Execute the Query

```typescript
import admin from 'firebase-admin';
import { FunctionRunner } from 'firestore-convex-style';

admin.initializeApp();
const firestore = admin.firestore();
const runner = new FunctionRunner(firestore, schema);

// Run it
const user = await runner.runQuery(getUser, {
  userId: "users:abc123"
});
```

## Next Steps

1. Check out the [README.md](./README.md) for full API documentation
2. Browse the [examples/](./examples/) directory for more complex examples
3. Read about [Valibot](https://valibot.dev/) for advanced validation patterns

## Key Concepts

### Document IDs

Document IDs are branded with their table name for type safety:

```typescript
// ✅ Correct - type-safe ID
const customerId: DocumentId<"customers"> = "customers:abc123";

// ❌ Wrong - won't compile if you pass to wrong table
await ctx.db.get<"users">(customerId); // Type error!
```

### Validation

All data is validated at runtime using Valibot:

```typescript
// This will throw if data doesn't match schema
await ctx.db.insert("users", {
  name: "John",
  email: "invalid", // If email had a v.email() validator, this would fail
});
```

### Queries

Queries use Firestore's native operators:

```typescript
const results = await ctx.db
  .query("users")
  .where("age", ">=", 18)
  .where("verified", "==", true)
  .order("name", "asc")
  .limit(10)
  .collect();
```

## Differences from Firestore SDK

| Feature | Firestore SDK | This Library |
|---------|--------------|--------------|
| Schema | None (optional) | Required, type-safe |
| Validation | Manual | Automatic via Valibot |
| Type Safety | Partial | Full end-to-end |
| API Style | OOP `.collection().doc()` | Convex-like `ctx.db.get()` |
| IDs | Plain strings | Branded types |

## Differences from Convex

| Feature | Convex | This Library |
|---------|--------|--------------|
| Database | Convex Cloud | Firestore |
| ID Format | Auto-generated | `tableName:docId` |
| Indexes | Auto-created | Manual (Firestore Console) |
| Real-time | Built-in subscriptions | Use Firestore listeners |
| Deployment | Convex platform | Your infrastructure |

## Tips

1. **Always validate IDs**: Use `v.id("tableName")` for type-safe references
2. **Use optional fields**: Firestore allows missing fields, so use `v.optional()` liberally
3. **Create indexes**: Define indexes in your schema for documentation, but create them in Firestore Console
4. **Type inference**: Let TypeScript infer types from your schema using `ExtractDataModel`
5. **Error handling**: Wrap function calls in try-catch for validation errors

## Troubleshooting

### "Invalid ID format" error

Make sure IDs include the table name prefix:
```typescript
// ❌ Wrong
const id = "abc123";

// ✅ Correct
const id = "users:abc123" as DocumentId<"users">;
```

### Type errors with validators

Import validators from the `v` namespace:
```typescript
import { v } from 'firestore-convex-style';

// Not from 'valibot' directly
```

### Schema validation errors

Check that your data matches the schema exactly:
```typescript
// If field is required in schema, it must be provided
await ctx.db.insert("users", {
  name: "John",
  // email: missing! Will throw if email is required
});
```


