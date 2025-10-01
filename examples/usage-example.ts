/**
 * Example demonstrating how to use the Firestore Convex Style SDK
 * with generated types for maximum type safety.
 */

import * as admin from "firebase-admin";
import { internalQuery, internalMutation } from "./_generated/server.js";
import type { Id, Doc, FunctionArgs, FunctionReturn } from "./_generated/dataModel.js";
import { v } from "../src/index.js";
import { DatabaseImpl } from "../src/server/database.js";
import { schema } from "./schema.js";

// Initialize Firebase Admin (you'd normally do this once in your app)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "demo-project",
  });
}

const firestore = admin.firestore();
const db = new DatabaseImpl(firestore, schema);

/**
 * Example Query: Get a user by ID
 *
 * Notice how the types work:
 * - args.userId is typed as Id<"users">
 * - return type is automatically inferred as Doc<"users"> | null
 */
export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    // ctx.db.get() knows exactly what fields exist on users
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // TypeScript knows about all user fields:
    // user.name, user.email, user.role, user.age, user._id, user._creationTime
    console.log(`Found user: ${user.name} (${user.email})`);

    return user;
  },
});

/**
 * Example Query: Search users by role
 *
 * The where() clause is type-safe - you can only query fields that exist!
 */
export const getUsersByRole = internalQuery({
  args: { role: v.union(v.literal("admin"), v.literal("user")) },
  handler: async (ctx, args) => {
    // "role" is autocompleted, and the value type is checked
    const users = await ctx.db
      .query("users")
      .where("role", "==", args.role) // ✅ Type-safe
      .order("name", "asc") // ✅ "name" is autocompleted
      .collect();

    return users;
  },
});

/**
 * Example Mutation: Create a new customer
 *
 * The insert operation is fully type-checked - you can't insert invalid data!
 */
export const createCustomer = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // First, verify the user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Insert is type-safe - try adding an invalid field and see the error!
    const customerId = await ctx.db.insert("customers", {
      userId: args.userId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      // ❌ This would be a type error:
      // invalidField: "test", // Property 'invalidField' does not exist
    });

    console.log(`Created customer ${customerId} for user ${user.name}`);

    return customerId;
  },
});

/**
 * Example Mutation: Update customer information
 *
 * The patch operation is also type-safe!
 */
export const updateCustomer = internalMutation({
  args: {
    customerId: v.id("customers"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { customerId, ...updates } = args;

    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    ) as Partial<Doc<"customers">>;

    // Patch is type-safe - you can only update fields that exist
    await ctx.db.patch(customerId, cleanUpdates);

    console.log(`Updated customer ${customerId}`);
  },
});

/**
 * Example Query: Get customer with related user data
 *
 * Shows how to do joins (fetching related documents)
 */
export const getCustomerWithUser = internalQuery({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    // Fetch the related user
    // Notice: customer.userId is correctly typed as Id<"users">
    const user = await ctx.db.get(customer.userId);
    if (!user) {
      throw new Error("Related user not found");
    }

    // Return a combined object
    return {
      customer,
      user,
    };
  },
});

/**
 * Example showing complex query with multiple filters
 */
export const searchCustomers = internalQuery({
  args: {
    userId: v.id("users"),
    searchTerm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let customers = await ctx.db
      .query("customers")
      .where("userId", "==", args.userId)
      .order("name", "asc")
      .collect();

    // Apply additional filtering in memory (Firestore doesn't support LIKE)
    if (args.searchTerm) {
      customers = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(args.searchTerm!.toLowerCase()) ||
          (c.email?.toLowerCase().includes(args.searchTerm!.toLowerCase()) ?? false)
      );
    }

    return customers;
  },
});

/**
 * Example showing transactions (mutations run in transactions automatically)
 */
export const transferCustomerToNewUser = internalMutation({
  args: {
    customerId: v.id("customers"),
    newUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Verify new user exists
    const newUser = await ctx.db.get(args.newUserId);
    if (!newUser) {
      throw new Error("New user not found");
    }

    // Verify customer exists
    const customer = await ctx.db.get(args.customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    // Update customer's userId
    // This entire mutation runs in a Firestore transaction
    await ctx.db.patch(args.customerId, {
      userId: args.newUserId,
    });

    console.log(`Transferred customer ${customer.name} to user ${newUser.name}`);

    return { success: true };
  },
});

// ============================================================================
// Demonstration of how you'd actually use these functions
// ============================================================================

async function demonstrateUsage() {
  console.log("🚀 Demonstrating Firestore Convex Style SDK\n");

  // Note: In a real app, you'd have a proper runtime that executes these
  // For now, we're just showing the type safety at compile time

  // Example 1: Extract argument types from registered queries/mutations
  type GetUserByIdArgs = FunctionArgs<typeof getUserById>;
  // GetUserByIdArgs is { userId: Id<"users"> } ✅

  type UserIdType = GetUserByIdArgs["userId"];
  // UserIdType is Id<"users"> ✅

  // Example 2: Extract return types from registered queries/mutations
  type GetUserByIdReturn = FunctionReturn<typeof getUserById>;
  // GetUserByIdReturn is Promise<Doc<"users">> (the handler returns a user or throws)

  // For the actual doc type, use Awaited:
  type UserType = Awaited<GetUserByIdReturn>;
  // UserType is Doc<"users"> ✅

  // Example 3: It works for mutations too!
  type CreateCustomerArgs = FunctionArgs<typeof createCustomer>;
  // CreateCustomerArgs is { userId: Id<"users">, name: string, email?: string, phone?: string } ✅

  type CreateCustomerReturn = Awaited<FunctionReturn<typeof createCustomer>>;
  // CreateCustomerReturn is Id<"customers"> ✅

  // Example 4: You can use the Id and Doc types directly
  function processUser(userId: Id<"users">, user: Doc<"users">) {
    console.log(`Processing user ${userId}: ${user.name}`);
    // All fields are available with autocomplete:
    // user.name, user.email, user.role, user.age, user._id, user._creationTime
  }

  console.log("✅ All types are working correctly!");
  console.log("\n📘 See CODEGEN_GUIDE.md for more information");
}

// Run demonstration
if (require.main === module) {
  demonstrateUsage().catch(console.error);
}
