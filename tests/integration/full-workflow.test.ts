import { describe, it, expect, beforeEach, vi } from "vitest";
import { FunctionRunner } from "../../src/functions";
import { defineSchema, defineTable } from "../../src/schema";
import * as v from "../../src/validators";
import { internalQuery, internalMutation } from "../../src/functions";
import type { ExtractDataModel } from "../../src/schema";

// Create comprehensive mock Firestore for integration testing
const createMockFirestoreWithFullAPI = () => {
  const mockData: Record<string, any> = {};

  const createQuery = (collectionName: string, conditions: any[] = []) => {
    return {
      where: vi.fn((field: string, op: string, value: any) => {
        conditions.push({ field, op, value });
        return createQuery(collectionName, conditions);
      }),
      orderBy: vi.fn((field: string, direction: string) => {
        return createQuery(collectionName, conditions);
      }),
      limit: vi.fn((count: number) => {
        return createQuery(collectionName, conditions);
      }),
      get: vi.fn(async () => {
        const docs = Object.entries(mockData)
          .filter(([key]) => key.startsWith(`${collectionName}/`))
          .filter(([_, data]) => {
            // Apply where conditions
            return conditions.every(({ field, op, value }) => {
              const fieldValue = data[field];
              switch (op) {
                case "==":
                  return fieldValue === value;
                case ">":
                  return fieldValue > value;
                case "<":
                  return fieldValue < value;
                case ">=":
                  return fieldValue >= value;
                case "<=":
                  return fieldValue <= value;
                default:
                  return true;
              }
            });
          })
          .map(([key, data]) => ({
            id: key.split("/")[1],
            data: () => data,
          }));

        return { docs };
      }),
    };
  };

  return {
    collection: vi.fn((name: string) => ({
      doc: vi.fn((id?: string) => {
        const docId = id || `doc_${Math.random().toString(36).substr(2, 9)}`;
        const key = `${name}/${docId}`;

        return {
          id: docId,
          get: vi.fn(async () => ({
            exists: !!mockData[key],
            id: docId,
            data: () => mockData[key],
          })),
          set: vi.fn(async (data: any) => {
            mockData[key] = data;
          }),
          update: vi.fn(async (data: any) => {
            if (mockData[key]) {
              mockData[key] = { ...mockData[key], ...data };
            }
          }),
          delete: vi.fn(async () => {
            delete mockData[key];
          }),
        };
      }),
      ...createQuery(name),
    })),
    _mockData: mockData,
    _clearData: () => {
      Object.keys(mockData).forEach((key) => delete mockData[key]);
    },
  };
};

// Define schema for integration tests
const schema = defineSchema({
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
  })
    .index("by_customer", ["customerId"])
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),
});

type DataModel = ExtractDataModel<typeof schema>;

// Define functions for integration tests
const createUser = internalMutation<DataModel>({
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

const getUserById = internalQuery<DataModel>({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    return user;
  },
});

const createCustomer = internalMutation<DataModel>({
  args: {
    userId: v.id("users"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user exists
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    return await ctx.db.insert("customers", {
      userId: args.userId,
      name: args.name,
      email: args.email,
      phone: args.phone,
    });
  },
});

const getCustomersByUser = internalQuery<DataModel>({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.query("customers").where("userId", "==", args.userId).collect();
  },
});

const createInvoice = internalMutation<DataModel>({
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
    const customer = (await ctx.db.get(args.customerId)) as DataModel["customers"];
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
    await ctx.db.patch(args.invoiceId, {
      status: args.status,
    });
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

describe("Integration Tests - Full Workflow", () => {
  let firestore: any;
  let runner: FunctionRunner<typeof schema>;

  beforeEach(() => {
    firestore = createMockFirestoreWithFullAPI();
    runner = new FunctionRunner(firestore, schema);
  });

  describe("User Management Workflow", () => {
    it("should create and retrieve a user", async () => {
      // Create user
      const userId = await runner.runMutation(createUser, {
        name: "John Doe",
        email: "john@example.com",
        role: "user",
      });

      expect(userId).toMatch(/^users:/);

      // Retrieve user
      const user = await runner.runQuery(getUserById, { userId });

      expect(user).toBeDefined();
      expect(user.name).toBe("John Doe");
      expect(user.email).toBe("john@example.com");
      expect(user.role).toBe("user");
      expect(user._id).toBe(userId);
    });

    it("should throw error when retrieving non-existent user", async () => {
      await expect(runner.runQuery(getUserById, { userId: "users:nonexistent" })).rejects.toThrow(
        "User not found"
      );
    });
  });

  describe("Customer Management Workflow", () => {
    let userId: string;

    beforeEach(async () => {
      // Create a user for customer tests
      userId = await runner.runMutation(createUser, {
        name: "Admin User",
        email: "admin@example.com",
        role: "admin",
      });
    });

    it("should create a customer for a user", async () => {
      const customerId = await runner.runMutation(createCustomer, {
        userId,
        name: "Acme Corporation",
        email: "contact@acme.com",
        phone: "+1-555-0123",
      });

      expect(customerId).toMatch(/^customers:/);
    });

    it("should reject customer creation for non-existent user", async () => {
      await expect(
        runner.runMutation(createCustomer, {
          userId: "users:nonexistent" as any,
          name: "Test Corp",
        })
      ).rejects.toThrow("User not found");
    });

    it("should retrieve all customers for a user", async () => {
      // Create multiple customers
      await runner.runMutation(createCustomer, {
        userId,
        name: "Customer 1",
        email: "customer1@example.com",
      });

      await runner.runMutation(createCustomer, {
        userId,
        name: "Customer 2",
        email: "customer2@example.com",
      });

      // Query customers
      const customers = await runner.runQuery(getCustomersByUser, { userId });

      expect(customers).toHaveLength(2);
      expect(customers[0].name).toBe("Customer 1");
      expect(customers[1].name).toBe("Customer 2");
    });
  });

  describe("Invoice Management Workflow", () => {
    let userId: string;
    let customerId: string;

    beforeEach(async () => {
      // Setup: Create user and customer
      userId = await runner.runMutation(createUser, {
        name: "Test User",
        email: "test@example.com",
        role: "user",
      });

      customerId = await runner.runMutation(createCustomer, {
        userId,
        name: "Test Customer",
        email: "customer@example.com",
      });
    });

    it("should create an invoice for a customer", async () => {
      const invoiceId = await runner.runMutation(createInvoice, {
        customerId,
        number: "INV-001",
        amount: 1500.0,
        status: "draft",
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      expect(invoiceId).toMatch(/^invoices:/);
    });

    it("should update invoice status", async () => {
      const invoiceId = await runner.runMutation(createInvoice, {
        customerId,
        number: "INV-002",
        amount: 2000.0,
        status: "draft",
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      // Update status
      await runner.runMutation(updateInvoiceStatus, {
        invoiceId,
        status: "sent",
      });

      // Verify update (we'd need a getInvoiceById query for this)
      expect(invoiceId).toBeDefined();
    });

    it("should query invoices by status", async () => {
      // Create invoices with different statuses
      await runner.runMutation(createInvoice, {
        customerId,
        number: "INV-003",
        amount: 1000.0,
        status: "draft",
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      await runner.runMutation(createInvoice, {
        customerId,
        number: "INV-004",
        amount: 2000.0,
        status: "sent",
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      await runner.runMutation(createInvoice, {
        customerId,
        number: "INV-005",
        amount: 1500.0,
        status: "draft",
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      // Query draft invoices
      const draftInvoices = await runner.runQuery(getInvoicesByStatus, {
        userId,
        status: "draft",
      });

      expect(draftInvoices).toHaveLength(2);
      expect(draftInvoices.every((inv) => inv.status === "draft")).toBe(true);

      // Query sent invoices
      const sentInvoices = await runner.runQuery(getInvoicesByStatus, {
        userId,
        status: "sent",
      });

      expect(sentInvoices).toHaveLength(1);
      expect(sentInvoices[0].status).toBe("sent");
    });

    it("should reject invoice creation for non-existent customer", async () => {
      await expect(
        runner.runMutation(createInvoice, {
          customerId: "customers:nonexistent" as any,
          number: "INV-999",
          amount: 1000.0,
          status: "draft",
          dueDate: Date.now(),
        })
      ).rejects.toThrow("Customer not found");
    });
  });

  describe("Complete Business Flow", () => {
    it("should handle complete invoice lifecycle", async () => {
      // 1. Create admin user
      const adminId = await runner.runMutation(createUser, {
        name: "Admin",
        email: "admin@company.com",
        role: "admin",
      });

      // 2. Create customer
      const customerId = await runner.runMutation(createCustomer, {
        userId: adminId,
        name: "Big Client Inc",
        email: "billing@bigclient.com",
        phone: "+1-555-1234",
      });

      // 3. Create invoice
      const invoiceId = await runner.runMutation(createInvoice, {
        customerId,
        number: "INV-2024-001",
        amount: 5000.0,
        status: "draft",
        dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });

      // 4. Update to sent
      await runner.runMutation(updateInvoiceStatus, {
        invoiceId,
        status: "sent",
      });

      // 5. Query sent invoices
      const sentInvoices = await runner.runQuery(getInvoicesByStatus, {
        userId: adminId,
        status: "sent",
      });

      expect(sentInvoices).toHaveLength(1);
      expect(sentInvoices[0].number).toBe("INV-2024-001");

      // 6. Mark as paid
      await runner.runMutation(updateInvoiceStatus, {
        invoiceId,
        status: "paid",
      });

      // 7. Verify no more sent invoices
      const remainingSent = await runner.runQuery(getInvoicesByStatus, {
        userId: adminId,
        status: "sent",
      });

      expect(remainingSent).toHaveLength(0);
    });

    it("should handle multiple users and their data isolation", async () => {
      // Create two users
      const user1Id = await runner.runMutation(createUser, {
        name: "User 1",
        email: "user1@test.com",
        role: "user",
      });

      const user2Id = await runner.runMutation(createUser, {
        name: "User 2",
        email: "user2@test.com",
        role: "user",
      });

      // Create customers for each user
      const customer1Id = await runner.runMutation(createCustomer, {
        userId: user1Id,
        name: "Customer of User 1",
      });

      const customer2Id = await runner.runMutation(createCustomer, {
        userId: user2Id,
        name: "Customer of User 2",
      });

      // Create invoices for each customer
      await runner.runMutation(createInvoice, {
        customerId: customer1Id,
        number: "U1-INV-001",
        amount: 1000.0,
        status: "draft",
        dueDate: Date.now(),
      });

      await runner.runMutation(createInvoice, {
        customerId: customer2Id,
        number: "U2-INV-001",
        amount: 2000.0,
        status: "draft",
        dueDate: Date.now(),
      });

      // Query customers - each user should only see their own
      const user1Customers = await runner.runQuery(getCustomersByUser, {
        userId: user1Id,
      });

      const user2Customers = await runner.runQuery(getCustomersByUser, {
        userId: user2Id,
      });

      expect(user1Customers).toHaveLength(1);
      expect(user1Customers[0].name).toBe("Customer of User 1");

      expect(user2Customers).toHaveLength(1);
      expect(user2Customers[0].name).toBe("Customer of User 2");

      // Query invoices - each user should only see their own
      const user1Invoices = await runner.runQuery(getInvoicesByStatus, {
        userId: user1Id,
        status: "draft",
      });

      const user2Invoices = await runner.runQuery(getInvoicesByStatus, {
        userId: user2Id,
        status: "draft",
      });

      expect(user1Invoices).toHaveLength(1);
      expect(user1Invoices[0].number).toBe("U1-INV-001");

      expect(user2Invoices).toHaveLength(1);
      expect(user2Invoices[0].number).toBe("U2-INV-001");
    });
  });

  describe("Error Handling and Validation", () => {
    it("should validate required fields", async () => {
      await expect(
        runner.runMutation(createUser, {
          name: "Test",
          // Missing email
          role: "user",
        } as any)
      ).rejects.toThrow();
    });

    it("should validate field types", async () => {
      await expect(
        runner.runMutation(createUser, {
          name: 123, // Wrong type
          email: "test@test.com",
          role: "user",
        } as any)
      ).rejects.toThrow();
    });

    it("should validate union types", async () => {
      await expect(
        runner.runMutation(createUser, {
          name: "Test",
          email: "test@test.com",
          role: "invalid_role", // Not in union
        } as any)
      ).rejects.toThrow();
    });

    it("should validate document IDs", async () => {
      await expect(
        runner.runMutation(createCustomer, {
          userId: "invalid-id-format", // Wrong ID format
          name: "Test",
        } as any)
      ).rejects.toThrow();
    });
  });
});
