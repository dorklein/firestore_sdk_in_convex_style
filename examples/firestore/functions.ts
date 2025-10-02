import { v } from "@smartbill/firestore-convex-style/values";
import type { DataModel } from "./_generated/dataModel.js";
import { internalMutation, internalQuery, mutation } from "./_generated/server.js";
import { internal, api } from "./_generated/api.js";

const CUSTOMER_NOT_FOUND_ERROR = "Customer not found";
const USER_NOT_FOUND_ERROR = "User not found";

// Queries
export const getCustomerById = internalQuery({
  args: { customerId: v.id("customers") },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error(CUSTOMER_NOT_FOUND_ERROR);
    return customer;
  },
});

export const getCustomersByUser = internalQuery({
  args: {
    userId: v.id("users"),
    customerId: v.id("customers"),
    searchName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("customers").where("userId", "==", args.userId);

    const customers = await query.order("name", "asc").collect();

    // Filter by name if provided (Firestore doesn't support LIKE queries)
    if (args.searchName) {
      return customers.filter((c) => c.name.toLowerCase().includes(args.searchName!.toLowerCase()));
    }

    return customers;
  },
});

export const getInvoicesByStatus = internalQuery({
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
    const invoices = await ctx.db
      .query("invoices")
      .where("userId", "==", args.userId)
      .where("status", "==", args.status)
      .order("issueDate", "desc")
      .collect();

    return invoices;
  },
});

// Mutations
export const createCustomer = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    contactName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Verify user exists
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error(USER_NOT_FOUND_ERROR);

    const customerId = await ctx.db.insert("customers", {
      userId: args.userId,
      name: args.name,
      email: args.email,
      phone: args.phone,
      address: args.address,
      contactName: args.contactName,
      taxId: undefined,
      tags: undefined,
      metadata: undefined,
    });

    return customerId;
  },
});

export const updateCustomer = internalMutation({
  args: {
    customerId: v.id("customers"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    contactName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { customerId, ...updates } = args;

    // Remove undefined values
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(customerId, cleanUpdates as any);
  },
});

export const createInvoice = mutation({
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
    issueDate: v.number(),
    dueDate: v.number(),
    items: v.array(
      v.object({
        description: v.string(),
        quantity: v.number(),
        price: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error(CUSTOMER_NOT_FOUND_ERROR);

    const invoiceId = await ctx.db.insert("invoices", {
      customerId: args.customerId,
      userId: customer.userId,
      number: args.number,
      amount: args.amount,
      status: args.status,
      issueDate: args.issueDate,
      dueDate: args.dueDate,
      items: args.items,
    });

    return invoiceId;
  },
});

export const updateInvoiceStatus = internalMutation({
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

export const deleteCustomer = internalMutation({
  args: {
    customerId: v.id("customers"),
  },
  handler: async (ctx, args) => {
    // Check if customer has invoices
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error(CUSTOMER_NOT_FOUND_ERROR);

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
