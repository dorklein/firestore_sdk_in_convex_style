import { v } from "@smartbill/firestore-convex-style/values";
import { internalAction, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

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
    // Simulate user processing
    await ctx.runQuery(internal.functions.getCustomerById, { customerId: args.customerId });
    await ctx.runMutation(internal.functions.createCustomer, {
      userId: args.userId,
      name: args.operation,
    });
    await ctx.runAction(internal.demoWithActions.tryProcessUserAction, {
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
