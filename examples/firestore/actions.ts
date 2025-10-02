import { v } from "@smartbill/firestore-convex-style/values";
import type { DataModel } from "./_generated/dataModel.js";
import { internalAction, internalQuery, internalMutation } from "./_generated/server.js";

// Example actions demonstrating different patterns

/**
 * Send email notification action
 * 
 * This action demonstrates:
 * - Reading data via ctx.runQuery
 * - Writing data via ctx.runMutation
 * - Performing side effects (email sending)
 */
export const sendEmailNotification = internalAction({
  args: {
    userId: v.id("users"),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Read user data via query
    const user = await ctx.runQuery(getUserById, { userId: args.userId });
    if (!user) {
      throw new Error("User not found");
    }

    // 2. Perform side effect - send email (simulated)
    console.log(`📧 Sending email to ${user.email}:`);
    console.log(`   Subject: ${args.subject}`);
    console.log(`   Message: ${args.message}`);
    
    // In a real app, you would call an email service here:
    // await emailService.send({
    //   to: user.email,
    //   subject: args.subject,
    //   body: args.message,
    // });

    // 3. Log the notification via mutation
    await ctx.runMutation(createNotificationLog, {
      userId: args.userId,
      type: "email",
      subject: args.subject,
      message: args.message,
    });

    return {
      success: true,
      recipient: user.email,
      sentAt: Date.now(),
    };
  },
});

/**
 * Process webhook action
 * 
 * This action demonstrates:
 * - Processing external webhook data
 * - Conditional logic based on webhook type
 * - Multiple database operations
 */
export const processWebhook = internalAction({
  args: {
    eventType: v.string(),
    payload: v.object({
      data: v.string(),
      timestamp: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    // 1. Validate webhook (side effect)
    const isValid = await validateWebhook(args.eventType, args.payload);
    if (!isValid) {
      throw new Error("Invalid webhook");
    }

    // 2. Process based on event type
    let result;
    switch (args.eventType) {
      case "payment.success":
        result = await processPaymentSuccess(ctx, args.payload);
        break;
      case "user.created":
        result = await processUserCreated(ctx, args.payload);
        break;
      default:
        result = { processed: false, reason: "Unknown event type" };
    }

    // 3. Log the webhook processing
    await ctx.runMutation(createWebhookLog, {
      eventType: args.eventType,
      payload: args.payload,
      processed: result.processed,
    });

    return result;
  },
});

/**
 * Batch process users action
 * 
 * This action demonstrates:
 * - Reading multiple records
 * - Processing in batches
 * - Calling other actions
 */
export const batchProcessUsers = internalAction({
  args: {
    batchSize: v.number(),
    operation: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Get all users via query
    const users = await ctx.runQuery(getAllUsers, {});
    
    // 2. Process in batches
    const results = [];
    for (let i = 0; i < users.length; i += args.batchSize) {
      const batch = users.slice(i, i + args.batchSize);
      
      // Process each user in the batch
      for (const user of batch) {
        try {
          // Call another action for each user
          const result = await ctx.runAction(processUserAction, {
            userId: user._id,
            operation: args.operation,
          });
          results.push({ userId: user._id, success: true, result });
        } catch (error) {
          results.push({ 
            userId: user._id, 
            success: false, 
            error: error instanceof Error ? error.message : "Unknown error" 
          });
        }
      }
    }

    return {
      totalProcessed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  },
});

/**
 * External API integration action
 * 
 * This action demonstrates:
 * - Calling external APIs
 * - Error handling
 * - Data transformation
 */
export const syncWithExternalAPI = internalAction({
  args: {
    apiUrl: v.string(),
    syncType: v.union(v.literal("users"), v.literal("products")),
  },
  handler: async (ctx, args) => {
    try {
      // 1. Fetch data from external API (side effect)
      const response = await fetch(args.apiUrl);
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const externalData = await response.json();
      
      // 2. Transform and sync data based on type
      let syncResult;
      if (args.syncType === "users") {
        syncResult = await syncUsers(ctx, externalData);
      } else {
        syncResult = await syncProducts(ctx, externalData);
      }

      // 3. Log the sync operation
      await ctx.runMutation(createSyncLog, {
        syncType: args.syncType,
        apiUrl: args.apiUrl,
        recordsProcessed: syncResult.count,
        success: true,
      });

      return syncResult;
    } catch (error) {
      // Log failed sync
      await ctx.runMutation(createSyncLog, {
        syncType: args.syncType,
        apiUrl: args.apiUrl,
        recordsProcessed: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      
      throw error;
    }
  },
});

// Helper functions (these would be defined elsewhere in a real app)

async function validateWebhook(eventType: string, payload: any): Promise<boolean> {
  // Simulate webhook validation
  return eventType.length > 0 && payload.data.length > 0;
}

async function processPaymentSuccess(ctx: any, payload: any) {
  // Simulate payment processing
  await ctx.runMutation(updatePaymentStatus, {
    paymentId: payload.data,
    status: "completed",
  });
  
  return { processed: true, paymentId: payload.data };
}

async function processUserCreated(ctx: any, payload: any) {
  // Simulate user creation processing
  return { processed: true, userId: payload.data };
}

async function syncUsers(ctx: any, data: any[]) {
  let count = 0;
  for (const userData of data) {
    await ctx.runMutation(upsertUser, {
      externalId: userData.id,
      name: userData.name,
      email: userData.email,
    });
    count++;
  }
  return { count, type: "users" };
}

async function syncProducts(ctx: any, data: any[]) {
  let count = 0;
  for (const productData of data) {
    await ctx.runMutation(upsertProduct, {
      externalId: productData.id,
      name: productData.name,
      price: productData.price,
    });
    count++;
  }
  return { count, type: "products" };
}

// Placeholder mutations and queries (these would be defined in functions.ts)
const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

const getAllUsers = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

const createNotificationLog = internalMutation({
  args: {
    userId: v.id("users"),
    type: v.string(),
    subject: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      subject: args.subject,
      message: args.message,
      createdAt: Date.now(),
    });
  },
});

const createWebhookLog = internalMutation({
  args: {
    eventType: v.string(),
    payload: v.any(),
    processed: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("webhook_logs", {
      eventType: args.eventType,
      payload: args.payload,
      processed: args.processed,
      timestamp: Date.now(),
    });
  },
});

const createSyncLog = internalMutation({
  args: {
    syncType: v.string(),
    apiUrl: v.string(),
    recordsProcessed: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sync_logs", {
      syncType: args.syncType,
      apiUrl: args.apiUrl,
      recordsProcessed: args.recordsProcessed,
      success: args.success,
      error: args.error,
      timestamp: Date.now(),
    });
  },
});

const processUserAction = internalAction({
  args: {
    userId: v.id("users"),
    operation: v.string(),
  },
  handler: async (ctx, args) => {
    // Simulate user processing
    return { userId: args.userId, operation: args.operation, processed: true };
  },
});

const updatePaymentStatus = internalMutation({
  args: {
    paymentId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    // Simulate payment update
    return { paymentId: args.paymentId, status: args.status };
  },
});

const upsertUser = internalMutation({
  args: {
    externalId: v.string(),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Simulate user upsert
    return { externalId: args.externalId, name: args.name, email: args.email };
  },
});

const upsertProduct = internalMutation({
  args: {
    externalId: v.string(),
    name: v.string(),
    price: v.number(),
  },
  handler: async (ctx, args) => {
    // Simulate product upsert
    return { externalId: args.externalId, name: args.name, price: args.price };
  },
});
