import { defineSchema, defineTable, v, type ExtractDataModel } from "../src";

// Define your database schema
export const schema = defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    age: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

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
  })
    .index("by_user", ["userId"])
    .index("by_user_and_name", ["userId", "name"]),

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
  })
    .index("by_customer", ["customerId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_due_date", ["dueDate"]),
});

// Extract TypeScript types from schema
export type DataModel = ExtractDataModel<typeof schema>;

