import { v } from "@smartbill/firestore-convex-style/values";
import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { createCustomer, getCustomerById } from "./functions";

// Example actions demonstrating different patterns

// Placeholder mutations and queries (these would be defined in functions.ts)
export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const createNotificationLog = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("customers", {
      userId: args.userId,
      name: args.name,
    });
  },
});

export const processUserAction = internalAction({
  args: {
    userId: v.id("users"),
    customerId: v.id("customers"),
    operation: v.string(),
  },
  handler: async (ctx, args) => {
    // Inspect the function reference

    // Simulate user processing
    const customerId = await ctx.runMutation(createCustomer, {
      userId: args.userId,
      name: args.operation,
    });
    console.log({ customerId });
    const customer = await ctx.runQuery(getCustomerById, {
      customerId: args.customerId,
    });
    console.log({ customer });
    await ctx.runAction(tryProcessUserAction, {
      userId: args.userId,
      customerId: args.customerId,
      operation: args.operation,
    });
    return { userId: args.userId, operation: args.operation, processed: true };
  },
});

export const tryProcessUserAction = internalAction({
  args: {
    userId: v.id("users"),
    customerId: v.id("customers"),
    operation: v.string(),
  },
  handler: async (ctx, args) => {
    return { userId: args.userId, operation: args.operation, processed: true };
  },
});
