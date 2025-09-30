/**
 * E2E tests for transactional behavior in mutations
 *
 * These tests verify that mutations run in transactions and that
 * all changes are rolled back if any error occurs during the mutation.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FunctionRunner, internalMutation, v, defineSchema, defineTable } from "../../src";
import {
  initializeFirebaseEmulator,
  clearFirestoreData,
  cleanupFirebase,
  isEmulatorRunning,
} from "./helpers/emulator";
import type { Firestore } from "firebase-admin/firestore";

// Test schema
const testSchema = defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
  }),
  accounts: defineTable({
    userId: v.id("users"),
    balance: v.number(),
  }),
  transactions: defineTable({
    fromAccountId: v.id("accounts"),
    toAccountId: v.id("accounts"),
    amount: v.number(),
  }),
});

let firestore: Firestore;
let runner: FunctionRunner<any>;

beforeAll(async () => {
  // Check if emulator is running
  const emulatorRunning = await isEmulatorRunning();
  if (!emulatorRunning) {
    throw new Error("Firebase Emulator is not running! Please start it with: pnpm emulator:start");
  }

  firestore = initializeFirebaseEmulator();
  runner = new FunctionRunner(firestore, testSchema);
});

afterAll(async () => {
  await cleanupFirebase();
});

beforeEach(async () => {
  await clearFirestoreData(firestore);
});

describe("Transaction Rollback Behavior", () => {
  it("should roll back all changes when mutation throws an error", async () => {
    // Create a mutation that creates a user and then throws
    const createUserThenFail = internalMutation({
      args: {
        name: v.string(),
        email: v.string(),
      },
      handler: async (ctx, args) => {
        // Insert a user
        const userId = await ctx.db.insert("users", {
          name: args.name,
          email: args.email,
        });

        // Throw an error
        throw new Error("Something went wrong!");

        return userId; // This should never be reached
      },
    });

    // Run the mutation and expect it to fail
    await expect(
      runner.runMutation(createUserThenFail, {
        name: "John Doe",
        email: "john@example.com",
      })
    ).rejects.toThrow("Something went wrong!");

    // Verify that no user was created (transaction rolled back)
    const usersSnapshot = await firestore.collection("users").get();
    expect(usersSnapshot.empty).toBe(true);
  });

  it("should roll back multiple inserts when mutation fails", async () => {
    // Create a mutation that creates multiple documents and then fails
    const createMultipleThenFail = internalMutation({
      args: {
        count: v.number(),
      },
      handler: async (ctx, args) => {
        const userIds = [];

        // Insert multiple users
        for (let i = 0; i < args.count; i++) {
          const userId = await ctx.db.insert("users", {
            name: `User ${i}`,
            email: `user${i}@example.com`,
          });
          userIds.push(userId);
        }

        // Throw an error after all inserts
        throw new Error("Rollback all inserts!");

        return userIds;
      },
    });

    // Run the mutation and expect it to fail
    await expect(runner.runMutation(createMultipleThenFail, { count: 5 })).rejects.toThrow(
      "Rollback all inserts!"
    );

    // Verify that no users were created
    const usersSnapshot = await firestore.collection("users").get();
    expect(usersSnapshot.empty).toBe(true);
  });

  it("should roll back updates when mutation fails", async () => {
    // First, create a user outside of a transaction
    const userRef = await firestore.collection("users").add({
      name: "Original Name",
      email: "original@example.com",
      _creationTime: Date.now(),
    });
    const userId = `users:${userRef.id}` as any;

    // Create a mutation that updates the user and then fails
    const updateThenFail = internalMutation({
      args: {
        userId: v.id("users"),
        newName: v.string(),
      },
      handler: async (ctx, args) => {
        await ctx.db.patch(args.userId, {
          name: args.newName,
        });

        throw new Error("Update should be rolled back!");
      },
    });

    // Run the mutation and expect it to fail
    await expect(
      runner.runMutation(updateThenFail, {
        userId,
        newName: "New Name",
      })
    ).rejects.toThrow("Update should be rolled back!");

    // Verify that the user still has the original name
    const userDoc = await firestore.collection("users").doc(userRef.id).get();
    expect(userDoc.data()?.name).toBe("Original Name");
  });

  it("should roll back deletes when mutation fails", async () => {
    // First, create a user outside of a transaction
    const userRef = await firestore.collection("users").add({
      name: "Test User",
      email: "test@example.com",
      _creationTime: Date.now(),
    });
    const userId = `users:${userRef.id}` as any;

    // Create a mutation that deletes the user and then fails
    const deleteThenFail = internalMutation({
      args: {
        userId: v.id("users"),
      },
      handler: async (ctx, args) => {
        await ctx.db.delete(args.userId);

        throw new Error("Delete should be rolled back!");
      },
    });

    // Run the mutation and expect it to fail
    await expect(runner.runMutation(deleteThenFail, { userId })).rejects.toThrow(
      "Delete should be rolled back!"
    );

    // Verify that the user still exists
    const userDoc = await firestore.collection("users").doc(userRef.id).get();
    expect(userDoc.exists).toBe(true);
    expect(userDoc.data()?.name).toBe("Test User");
  });

  it("should roll back mixed operations (insert, update, delete)", async () => {
    // Create initial data
    const user1Ref = await firestore.collection("users").add({
      name: "User 1",
      email: "user1@example.com",
      _creationTime: Date.now(),
    });
    const user1Id = `users:${user1Ref.id}` as any;

    const user2Ref = await firestore.collection("users").add({
      name: "User 2",
      email: "user2@example.com",
      _creationTime: Date.now(),
    });
    const user2Id = `users:${user2Ref.id}` as any;

    // Create a mutation that performs multiple operations and then fails
    const mixedOperationsThenFail = internalMutation({
      args: {},
      handler: async (ctx, args) => {
        // Insert a new user
        await ctx.db.insert("users", {
          name: "User 3",
          email: "user3@example.com",
        });

        // Update an existing user
        await ctx.db.patch(user1Id, {
          name: "User 1 Updated",
        });

        // Delete an existing user
        await ctx.db.delete(user2Id);

        // Throw an error
        throw new Error("All operations should be rolled back!");
      },
    });

    // Run the mutation and expect it to fail
    await expect(runner.runMutation(mixedOperationsThenFail, {})).rejects.toThrow(
      "All operations should be rolled back!"
    );

    // Verify state is unchanged
    const usersSnapshot = await firestore.collection("users").get();
    expect(usersSnapshot.size).toBe(2); // User 3 was not created, User 2 was not deleted

    const user1Doc = await firestore.collection("users").doc(user1Ref.id).get();
    expect(user1Doc.data()?.name).toBe("User 1"); // Not updated

    const user2Doc = await firestore.collection("users").doc(user2Ref.id).get();
    expect(user2Doc.exists).toBe(true); // Not deleted
  });

  it("should commit all changes when mutation succeeds", async () => {
    // Create a mutation that performs multiple operations successfully
    const successfulMutation = internalMutation({
      args: {
        userName: v.string(),
        userEmail: v.string(),
      },
      handler: async (ctx, args) => {
        const userId = await ctx.db.insert("users", {
          name: args.userName,
          email: args.userEmail,
        });

        const account1Id = await ctx.db.insert("accounts", {
          userId,
          balance: 1000,
        });

        const account2Id = await ctx.db.insert("accounts", {
          userId,
          balance: 2000,
        });

        return { userId, account1Id, account2Id };
      },
    });

    // Run the mutation
    const result = await runner.runMutation(successfulMutation, {
      userName: "John Doe",
      userEmail: "john@example.com",
    });

    expect(result.userId).toBeDefined();
    expect(result.account1Id).toBeDefined();
    expect(result.account2Id).toBeDefined();

    // Verify all data was committed
    const usersSnapshot = await firestore.collection("users").get();
    expect(usersSnapshot.size).toBe(1);

    const accountsSnapshot = await firestore.collection("accounts").get();
    expect(accountsSnapshot.size).toBe(2);
  });

  it("should handle conditional logic and roll back on failure", async () => {
    // Create initial data
    const userRef = await firestore.collection("users").add({
      name: "Account Holder",
      email: "holder@example.com",
      _creationTime: Date.now(),
    });
    const userId = `users:${userRef.id}` as any;

    const account1Ref = await firestore.collection("accounts").add({
      userId,
      balance: 1000,
      _creationTime: Date.now(),
    });
    const account1Id = `accounts:${account1Ref.id}` as any;

    const account2Ref = await firestore.collection("accounts").add({
      userId,
      balance: 500,
      _creationTime: Date.now(),
    });
    const account2Id = `accounts:${account2Ref.id}` as any;

    // Create a mutation that transfers money but fails if insufficient funds
    const transferMoney = internalMutation({
      args: {
        fromAccountId: v.id("accounts"),
        toAccountId: v.id("accounts"),
        amount: v.number(),
      },
      handler: async (ctx, args) => {
        // Get source account
        const fromAccount = await ctx.db.get(args.fromAccountId);
        if (!fromAccount) {
          throw new Error("Source account not found");
        }

        // Check if sufficient balance
        if (fromAccount.balance < args.amount) {
          throw new Error("Insufficient funds");
        }

        // Get destination account
        const toAccount = await ctx.db.get(args.toAccountId);
        if (!toAccount) {
          throw new Error("Destination account not found");
        }

        // Deduct from source
        await ctx.db.patch(args.fromAccountId, {
          balance: fromAccount.balance - args.amount,
        });

        // Add to destination
        await ctx.db.patch(args.toAccountId, {
          balance: toAccount.balance + args.amount,
        });

        // Create transaction record
        const txId = await ctx.db.insert("transactions", {
          fromAccountId: args.fromAccountId,
          toAccountId: args.toAccountId,
          amount: args.amount,
        });

        return txId;
      },
    });

    // Try to transfer more than available - should roll back
    await expect(
      runner.runMutation(transferMoney, {
        fromAccountId: account1Id,
        toAccountId: account2Id,
        amount: 2000, // More than the 1000 balance
      })
    ).rejects.toThrow("Insufficient funds");

    // Verify balances are unchanged
    const account1Doc = await firestore.collection("accounts").doc(account1Ref.id).get();
    expect(account1Doc.data()?.balance).toBe(1000);

    const account2Doc = await firestore.collection("accounts").doc(account2Ref.id).get();
    expect(account2Doc.data()?.balance).toBe(500);

    // Verify no transaction was created
    const txSnapshot = await firestore.collection("transactions").get();
    expect(txSnapshot.empty).toBe(true);

    // Now try a valid transfer - should succeed
    const txId = await runner.runMutation(transferMoney, {
      fromAccountId: account1Id,
      toAccountId: account2Id,
      amount: 300,
    });

    expect(txId).toBeDefined();

    // Verify balances are updated
    const updatedAccount1 = await firestore.collection("accounts").doc(account1Ref.id).get();
    expect(updatedAccount1.data()?.balance).toBe(700);

    const updatedAccount2 = await firestore.collection("accounts").doc(account2Ref.id).get();
    expect(updatedAccount2.data()?.balance).toBe(800);

    // Verify transaction was created
    const txSnapshot2 = await firestore.collection("transactions").get();
    expect(txSnapshot2.size).toBe(1);
  });

  it("should handle validation errors and roll back", async () => {
    // Create a mutation that validates data mid-execution
    const createWithValidation = internalMutation({
      args: {
        name: v.string(),
        email: v.string(),
        balance: v.number(),
      },
      handler: async (ctx, args) => {
        const userId = await ctx.db.insert("users", {
          name: args.name,
          email: args.email,
        });

        // Custom validation after insert
        if (args.balance < 0) {
          throw new Error("Balance cannot be negative");
        }

        await ctx.db.insert("accounts", {
          userId,
          balance: args.balance,
        });

        return userId;
      },
    });

    // Try with invalid balance
    await expect(
      runner.runMutation(createWithValidation, {
        name: "Test User",
        email: "test@example.com",
        balance: -100,
      })
    ).rejects.toThrow("Balance cannot be negative");

    // Verify nothing was created
    const usersSnapshot = await firestore.collection("users").get();
    expect(usersSnapshot.empty).toBe(true);

    const accountsSnapshot = await firestore.collection("accounts").get();
    expect(accountsSnapshot.empty).toBe(true);
  });

  it("should handle errors from nested database operations", async () => {
    // Create a mutation that tries to update a non-existent document
    const updateNonExistent = internalMutation({
      args: {
        userId: v.id("users"),
      },
      handler: async (ctx, args) => {
        // First, create a user
        const newUserId = await ctx.db.insert("users", {
          name: "New User",
          email: "new@example.com",
        });

        // Try to update a non-existent user (will throw from Firestore)
        await ctx.db.patch(args.userId, {
          name: "Updated Name",
        });

        return newUserId;
      },
    });

    // Run with non-existent user ID
    await expect(
      runner.runMutation(updateNonExistent, {
        userId: "users:nonexistent" as any,
      })
    ).rejects.toThrow();

    // Verify the new user was not created (rolled back)
    const usersSnapshot = await firestore.collection("users").get();
    expect(usersSnapshot.empty).toBe(true);
  });
});
