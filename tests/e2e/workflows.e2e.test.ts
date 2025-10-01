import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FunctionRunner } from "../../src/server/functions";
import { defineSchema, defineTable } from "../../src/server/schema";
import * as v from "../../src/validators";
import { internalQuery, internalMutation } from "../../src/server/functions";
import type { ExtractDataModel } from "../../src/server/schema";
import type { Firestore } from "firebase-admin/firestore";
import {
  initializeFirebaseEmulator,
  clearFirestoreData,
  cleanupFirebase,
  isEmulatorRunning,
} from "./helpers/emulator";

// Define schema definition separately for proper typing
const schemaDefinition = {
  users: defineTable({
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  customers: defineTable({
    userId: v.id("users"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
  }).index("by_user", ["userId"]),

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
  })
    .index("by_customer", ["customerId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),
};

const schema = defineSchema(schemaDefinition);
type DataModel = ExtractDataModel<typeof schemaDefinition>;

// Define functions with proper DataModel type
const createUser = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("admin"), v.literal("user")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", {
      name: args.name,
      email: args.email,
      role: args.role,
      createdAt: Date.now(),
    });
  },
});

const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    return user;
  },
});

const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").where("email", "==", args.email).collect();
    return users[0] || null;
  },
});

const createCustomer = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("customers", {
      userId: args.userId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      address: args.address,
    });
  },
});

const getCustomersByUser = internalQuery<DataModel>({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.query("customers").where("userId", "==", args.userId).collect();
  },
});

const updateCustomer = internalMutation<DataModel>({
  args: {
    customerId: v.id("customers"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { customerId, ...updates } = args;
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(customerId, cleanUpdates as any);
  },
});

const deleteCustomer = internalMutation<DataModel>({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    // Check for invoices
    const invoices = await ctx.db
      .query("invoices")
      .where("customerId", "==", args.customerId)
      .limit(1)
      .collect();

    if (invoices.length > 0) {
      throw new Error("Cannot delete customer with existing invoices");
    }

    await ctx.db.delete(args.customerId);
  },
});

const createInvoice = internalMutation({
  args: {
    customerId: v.id("customers"),
    number: v.string(),
    amount: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("cancelled")
    ),
    dueDate: v.number(),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("Customer not found");

    return await ctx.db.insert("invoices", {
      customerId: args.customerId,
      userId: customer.userId,
      number: args.number,
      amount: args.amount,
      status: args.status,
      issueDate: Date.now(),
      dueDate: args.dueDate,
    });
  },
});

const updateInvoiceStatus = internalMutation<DataModel>({
  args: {
    invoiceId: v.id("invoices"),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, { status: args.status });
  },
});

const getInvoicesByStatus = internalQuery<DataModel>({
  args: {
    userId: v.id("users"),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoices")
      .where("userId", "==", args.userId)
      .where("status", "==", args.status)
      .collect();
  },
});

const getCustomerInvoices = internalQuery<DataModel>({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("invoices")
      .where("customerId", "==", args.customerId)
      .order("issueDate", "desc")
      .collect();
  },
});

const getTotalRevenue = internalQuery<DataModel>({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .where("userId", "==", args.userId)
      .where("status", "==", "paid")
      .collect();

    return invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  },
});

describe("E2E Workflow Tests with Firebase Emulator", () => {
  let firestore: Firestore;
  let runner: ReturnType<typeof createRunner>;

  function createRunner(fs: Firestore) {
    return new FunctionRunner(fs, schema);
  }

  beforeAll(async () => {
    const emulatorRunning = await isEmulatorRunning();
    if (!emulatorRunning) {
      throw new Error(
        "Firebase Emulator is not running! Please start it with: pnpm emulator:start"
      );
    }

    firestore = initializeFirebaseEmulator();
    runner = createRunner(firestore);
  });

  beforeEach(async () => {
    await clearFirestoreData(firestore);
  });

  afterAll(async () => {
    await cleanupFirebase();
  });

  describe("User Management", () => {
    it("should create and retrieve a user", async () => {
      const userId = await runner.runMutation(createUser, {
        name: "John Doe",
        email: "john@example.com",
        role: "user",
      });

      expect(userId).toMatch(/^users:/);

      const user = await runner.runQuery(getUserById, { userId });
      expect(user.name).toBe("John Doe");
      expect(user.email).toBe("john@example.com");
      expect(user.role).toBe("user");
    });

    it("should find user by email", async () => {
      await runner.runMutation(createUser, {
        name: "Jane Doe",
        email: "jane@example.com",
        role: "admin",
      });

      const user = await runner.runQuery(getUserByEmail, {
        email: "jane@example.com",
      });

      expect(user).toBeDefined();
      expect(user?.name).toBe("Jane Doe");
    });

    it("should return null for non-existent email", async () => {
      const user = await runner.runQuery(getUserByEmail, {
        email: "nonexistent@example.com",
      });

      expect(user).toBeNull();
    });

    it("should throw error for non-existent user ID", async () => {
      await expect(runner.runQuery(getUserById, { userId: "users:nonexistent" })).rejects.toThrow(
        "User not found"
      );
    });
  });

  describe("Customer Management", () => {
    let userId: string;

    beforeEach(async () => {
      userId = await runner.runMutation(createUser, {
        name: "Admin User",
        email: "admin@example.com",
        role: "admin",
      });
    });

    it("should create and retrieve customers", async () => {
      const customerId = await runner.runMutation(createCustomer, {
        userId,
        name: "Acme Corp",
        email: "contact@acme.com",
        phone: "+1-555-0123",
      });

      expect(customerId).toMatch(/^customers:/);

      const customers = await runner.runQuery(getCustomersByUser, { userId });
      expect(customers).toHaveLength(1);
      expect(customers[0].name).toBe("Acme Corp");
    });

    it("should create multiple customers for a user", async () => {
      await runner.runMutation(createCustomer, {
        userId,
        name: "Customer 1",
        email: "customer1@example.com",
      });

      await runner.runMutation(createCustomer, {
        userId,
        name: "Customer 2",
        phone: "+1-555-0001",
      });

      await runner.runMutation(createCustomer, {
        userId,
        name: "Customer 3",
      });

      const customers = await runner.runQuery(getCustomersByUser, { userId });
      expect(customers).toHaveLength(3);
    });

    it("should update customer information", async () => {
      const customerId = await runner.runMutation(createCustomer, {
        userId,
        name: "Old Name",
        email: "old@example.com",
      });

      await runner.runMutation(updateCustomer, {
        customerId,
        name: "New Name",
        phone: "+1-555-9999",
      });

      const customers = await runner.runQuery(getCustomersByUser, { userId });
      const customer = customers[0];

      expect(customer.name).toBe("New Name");
      expect(customer.email).toBe("old@example.com"); // Unchanged
      expect(customer.phone).toBe("+1-555-9999");
    });

    it("should delete customer without invoices", async () => {
      const customerId = await runner.runMutation(createCustomer, {
        userId,
        name: "To Delete",
      });

      await runner.runMutation(deleteCustomer, { customerId });

      const customers = await runner.runQuery(getCustomersByUser, { userId });
      expect(customers).toHaveLength(0);
    });

    it("should prevent deletion of customer with invoices", async () => {
      const customerId = await runner.runMutation(createCustomer, {
        userId,
        name: "Customer with Invoice",
      });

      await runner.runMutation(createInvoice, {
        customerId,
        number: "INV-001",
        amount: 1000,
        status: "draft",
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      await expect(runner.runMutation(deleteCustomer, { customerId })).rejects.toThrow(
        "Cannot delete customer with existing invoices"
      );
    });
  });

  describe("Invoice Lifecycle", () => {
    let userId: string;
    let customerId: string;

    beforeEach(async () => {
      userId = await runner.runMutation(createUser, {
        name: "Business Owner",
        email: "owner@business.com",
        role: "admin",
      });

      customerId = await runner.runMutation(createCustomer, {
        userId,
        name: "Client Corp",
        email: "billing@client.com",
      });
    });

    it("should create invoice and track through lifecycle", async () => {
      // Create draft invoice
      const invoiceId = await runner.runMutation(createInvoice, {
        customerId,
        number: "INV-2024-001",
        amount: 5000,
        status: "draft",
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      expect(invoiceId).toMatch(/^invoices:/);

      // Check draft status
      let drafts = await runner.runQuery(getInvoicesByStatus, {
        userId,
        status: "draft",
      });
      expect(drafts).toHaveLength(1);

      // Update to sent
      await runner.runMutation(updateInvoiceStatus, {
        invoiceId,
        status: "sent",
      });

      drafts = await runner.runQuery(getInvoicesByStatus, {
        userId,
        status: "draft",
      });
      expect(drafts).toHaveLength(0);

      const sent = await runner.runQuery(getInvoicesByStatus, {
        userId,
        status: "sent",
      });
      expect(sent).toHaveLength(1);

      // Mark as paid
      await runner.runMutation(updateInvoiceStatus, {
        invoiceId,
        status: "paid",
      });

      const paid = await runner.runQuery(getInvoicesByStatus, {
        userId,
        status: "paid",
      });
      expect(paid).toHaveLength(1);
      expect(paid[0].number).toBe("INV-2024-001");
    });

    it("should query invoices by customer", async () => {
      await runner.runMutation(createInvoice, {
        customerId,
        number: "INV-001",
        amount: 1000,
        status: "paid",
        dueDate: Date.now(),
      });

      await runner.runMutation(createInvoice, {
        customerId,
        number: "INV-002",
        amount: 2000,
        status: "sent",
        dueDate: Date.now(),
      });

      const invoices = await runner.runQuery(getCustomerInvoices, { customerId });
      expect(invoices).toHaveLength(2);
    });

    it("should calculate total revenue", async () => {
      await runner.runMutation(createInvoice, {
        customerId,
        number: "INV-001",
        amount: 1000,
        status: "paid",
        dueDate: Date.now(),
      });

      await runner.runMutation(createInvoice, {
        customerId,
        number: "INV-002",
        amount: 2500,
        status: "paid",
        dueDate: Date.now(),
      });

      await runner.runMutation(createInvoice, {
        customerId,
        number: "INV-003",
        amount: 3000,
        status: "sent", // Not paid
        dueDate: Date.now(),
      });

      const revenue = await runner.runQuery(getTotalRevenue, { userId });
      expect(revenue).toBe(3500); // Only paid invoices
    });
  });

  describe("Complete Business Scenario", () => {
    it("should handle complete multi-user business flow", async () => {
      // Create two business users
      const owner1Id = await runner.runMutation(createUser, {
        name: "Business Owner 1",
        email: "owner1@business.com",
        role: "admin",
      });

      const owner2Id = await runner.runMutation(createUser, {
        name: "Business Owner 2",
        email: "owner2@business.com",
        role: "admin",
      });

      // Owner 1 creates customers
      const customer1Id = await runner.runMutation(createCustomer, {
        userId: owner1Id,
        name: "Owner 1 Customer A",
        email: "customerA@example.com",
      });

      const customer2Id = await runner.runMutation(createCustomer, {
        userId: owner1Id,
        name: "Owner 1 Customer B",
      });

      // Owner 2 creates customer
      const customer3Id = await runner.runMutation(createCustomer, {
        userId: owner2Id,
        name: "Owner 2 Customer A",
      });

      // Verify customer isolation
      const owner1Customers = await runner.runQuery(getCustomersByUser, {
        userId: owner1Id,
      });
      const owner2Customers = await runner.runQuery(getCustomersByUser, {
        userId: owner2Id,
      });

      expect(owner1Customers).toHaveLength(2);
      expect(owner2Customers).toHaveLength(1);

      // Create invoices for owner 1
      await runner.runMutation(createInvoice, {
        customerId: customer1Id,
        number: "O1-INV-001",
        amount: 5000,
        status: "sent",
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      const invoice2Id = await runner.runMutation(createInvoice, {
        customerId: customer2Id,
        number: "O1-INV-002",
        amount: 3000,
        status: "draft",
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      // Create invoice for owner 2
      await runner.runMutation(createInvoice, {
        customerId: customer3Id,
        number: "O2-INV-001",
        amount: 7000,
        status: "paid",
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      // Verify invoice isolation
      const owner1Sent = await runner.runQuery(getInvoicesByStatus, {
        userId: owner1Id,
        status: "sent",
      });
      const owner2Paid = await runner.runQuery(getInvoicesByStatus, {
        userId: owner2Id,
        status: "paid",
      });

      expect(owner1Sent).toHaveLength(1);
      expect(owner2Paid).toHaveLength(1);

      // Mark owner1's draft invoice as paid
      await runner.runMutation(updateInvoiceStatus, {
        invoiceId: invoice2Id,
        status: "paid",
      });

      // Calculate revenues
      const owner1Revenue = await runner.runQuery(getTotalRevenue, {
        userId: owner1Id,
      });
      const owner2Revenue = await runner.runQuery(getTotalRevenue, {
        userId: owner2Id,
      });

      expect(owner1Revenue).toBe(3000);
      expect(owner2Revenue).toBe(7000);
    });
  });

  describe("Performance and Scale", () => {
    it("should handle bulk customer creation", async () => {
      const userId = await runner.runMutation(createUser, {
        name: "Bulk Test User",
        email: "bulk@example.com",
        role: "admin",
      });

      const promises = Array.from({ length: 20 }, (_, i) =>
        runner.runMutation(createCustomer, {
          userId,
          name: `Customer ${i}`,
          email: `customer${i}@example.com`,
        })
      );

      await Promise.all(promises);

      const customers = await runner.runQuery(getCustomersByUser, { userId });
      expect(customers).toHaveLength(20);
    });

    it("should handle complex invoice queries", async () => {
      const userId = await runner.runMutation(createUser, {
        name: "Test User",
        email: "test@example.com",
        role: "admin",
      });

      // Create multiple customers and invoices
      for (let i = 0; i < 5; i++) {
        const customerId = await runner.runMutation(createCustomer, {
          userId,
          name: `Customer ${i}`,
        });

        // Create 3 invoices per customer with different statuses
        await runner.runMutation(createInvoice, {
          customerId,
          number: `INV-${i}-1`,
          amount: 1000 + i * 100,
          status: "draft",
          dueDate: Date.now(),
        });

        await runner.runMutation(createInvoice, {
          customerId,
          number: `INV-${i}-2`,
          amount: 2000 + i * 100,
          status: "sent",
          dueDate: Date.now(),
        });

        await runner.runMutation(createInvoice, {
          customerId,
          number: `INV-${i}-3`,
          amount: 3000 + i * 100,
          status: "paid",
          dueDate: Date.now(),
        });
      }

      // Query different statuses
      const drafts = await runner.runQuery(getInvoicesByStatus, {
        userId,
        status: "draft",
      });
      const sent = await runner.runQuery(getInvoicesByStatus, {
        userId,
        status: "sent",
      });
      const paid = await runner.runQuery(getInvoicesByStatus, {
        userId,
        status: "paid",
      });

      expect(drafts).toHaveLength(5);
      expect(sent).toHaveLength(5);
      expect(paid).toHaveLength(5);

      // Calculate revenue
      const revenue = await runner.runQuery(getTotalRevenue, { userId });
      const expectedRevenue = [3000, 3100, 3200, 3300, 3400].reduce((a, b) => a + b, 0);
      expect(revenue).toBe(expectedRevenue);
    });
  });
});
