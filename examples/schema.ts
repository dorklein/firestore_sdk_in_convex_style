import { defineSchema, defineTable, v } from "../src";

// Define your database schema
export const schema = defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    age: v.optional(v.number()),
    createdAt: v.number(),
  }),

  customers: defineTable({
    userId: v.id("users"), // Reference to users table
    name: v.string(),
    email: v.optional(v.string()),
    taxId: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    contactName: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    metadata: v.optional(
      v.object({
        source: v.string(),
        notes: v.optional(v.string()),
      })
    ),
  }),

  invoices: defineTable({
    customerId: v.id("customers"),
    userId: v.id("users"),
    number: v.string(),
    amount: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("cancelled")
    ),
    issueDate: v.number(),
    dueDate: v.number(),
    items: v.array(
      v.object({
        description: v.string(),
        quantity: v.number(),
        price: v.number(),
      })
    ),
  }),
});

// Extract TypeScript types from schema
// export type DataModel = ExtractDataModel<typeof schema>;
