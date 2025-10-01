/**
 * Complete example showing how to use the Firestore Convex Style SDK
 * with the function runner to execute queries and mutations.
 */

import * as admin from "firebase-admin";
import { createFunctionRunner } from "@smartbill/firestore-convex-style/server";
import { schema } from "./schema.js";
import { internalQuery, internalMutation } from "./_generated/server.js";
import { v } from "@smartbill/firestore-convex-style/values";
import type { Id } from "./_generated/dataModel.js";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "demo-project",
  });
}

const firestore = admin.firestore();

// Create the function runner with our schema
const runner = createFunctionRunner(firestore, schema);

// ============================================================================
// Define some example functions
// ============================================================================

export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  },
});

export const createUser = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    age: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      role: args.role,
      age: args.age,
      createdAt: Date.now(),
    });
    console.log(`Created user: ${userId}`);
    return userId;
  },
});

export const updateUserAge = internalMutation({
  args: {
    userId: v.id("users"),
    age: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, { age: args.age });
    console.log(`Updated user ${args.userId} age to ${args.age}`);
  },
});

export const getUsersByRole = internalQuery({
  args: {
    role: v.union(v.literal("admin"), v.literal("user")),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db
      .query("users")
      .where("role", "==", args.role)
      .order("name", "asc")
      .collect();
    return users;
  },
});

export const createCustomer = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user exists
    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    const customerId = await ctx.db.insert("customers", {
      userId: args.userId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      taxId: undefined,
      address: undefined,
      contactName: undefined,
      tags: undefined,
      metadata: undefined,
    });

    console.log(`Created customer ${customerId} for user ${user.name}`);
    return customerId;
  },
});

// ============================================================================
// Example usage of the function runner
// ============================================================================

async function demonstrateUsage() {
  console.log("🚀 Demonstrating Function Runner\n");

  try {
    // Example 1: Create a new user (mutation)
    console.log("1️⃣ Creating a new user...");
    const userId = await runner.runMutation(createUser, {
      name: "Alice Smith",
      email: "alice@example.com",
      role: "user",
      age: 30,
    });
    console.log(`   ✅ Created user with ID: ${userId}\n`);

    // Example 2: Get the user back (query)
    console.log("2️⃣ Fetching the user...");
    const user = await runner.runQuery(getUserById, { userId });
    console.log(`   ✅ Found user: ${user.name} (${user.email})`);
    console.log(`   📧 Email: ${user.email}`);
    console.log(`   🎂 Age: ${user.age}`);
    console.log(`   👤 Role: ${user.role}\n`);

    // Example 3: Update the user (mutation)
    console.log("3️⃣ Updating user age...");
    await runner.runMutation(updateUserAge, {
      userId,
      age: 31,
    });
    console.log(`   ✅ Updated user age to 31\n`);

    // Example 4: Create a customer for this user
    console.log("4️⃣ Creating a customer...");
    const customerId = await runner.runMutation(createCustomer, {
      userId,
      name: "Acme Corp",
      email: "contact@acme.com",
      phone: "+1-555-0100",
    });
    console.log(`   ✅ Created customer with ID: ${customerId}\n`);

    // Example 5: Query users by role
    console.log("5️⃣ Querying users by role...");
    const regularUsers = await runner.runQuery(getUsersByRole, {
      role: "user",
    });
    console.log(`   ✅ Found ${regularUsers.length} regular user(s)\n`);

    // Example 6: Transaction rollback on error
    console.log("6️⃣ Testing transaction rollback...");
    try {
      await runner.runMutation(createCustomer, {
        userId: "users|invalid-id" as Id<"users">,
        name: "Bad Customer",
      });
    } catch (error) {
      console.log(`   ✅ Transaction rolled back: ${(error as Error).message}\n`);
    }

    console.log("✅ All examples completed successfully!");
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  }
}

// ============================================================================
// Type-safe examples showing IDE autocomplete
// ============================================================================

async function typeExamples() {
  // Example: Arguments are strongly typed
  await runner.runMutation(createUser, {
    name: "Bob",
    email: "bob@example.com",
    role: "admin", // ✅ Only "admin" | "user" allowed
    age: 25,
    // invalidField: true, // ❌ This would be a type error
  });

  // Example: Return types are inferred
  const user = await runner.runQuery(getUserById, {
    userId: "users|123" as Id<"users">,
  });
  // user is typed as Doc<"users">
  // All fields are available: user.name, user.email, user.role, etc.

  // Example: Query results are strongly typed
  const users = await runner.runQuery(getUsersByRole, { role: "admin" });
  // users is typed as Array<Doc<"users">>
  users.forEach((u) => {
    console.log(u.name, u.email, u.role); // All fields autocomplete!
  });
}

// ============================================================================
// Run the demonstration
// ============================================================================

if (require.main === module) {
  demonstrateUsage()
    .then(() => {
      console.log("\n🎉 Demo completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Demo failed:", error);
      process.exit(1);
    });
}

export { runner };
