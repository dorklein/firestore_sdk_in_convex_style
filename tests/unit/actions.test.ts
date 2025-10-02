import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  internalQuery,
  internalMutation,
  internalAction,
  FunctionRunner,
} from "../../src/server/index.ts";
import { defineSchema, defineTable } from "../../src/server/schema.ts";
import { v } from "../../src/values/index.ts";

// Mock Firestore setup
const createMockFirestore = () => {
  const mockData: Record<string, any> = {};

  const createDocRef = (name: string, id?: string) => {
    const docId = id || `doc_${Math.random()}`;
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
  };

  const firestore = {
    collection: vi.fn((name: string) => ({
      doc: vi.fn((id?: string) => createDocRef(name, id)),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn(async () => {
        const docs = Object.entries(mockData)
          .filter(([key]) => key.startsWith(name))
          .map(([key, data]) => ({
            id: key.split("/")[1],
            data: () => data,
          }));
        return { docs };
      }),
    })),
    runTransaction: vi.fn(async (updateFunction: any) => {
      // Create a mock transaction that behaves similarly to the real one
      const transaction = {
        get: vi.fn(async (docRef: any) => {
          return await docRef.get();
        }),
        set: vi.fn((docRef: any, data: any) => {
          return docRef.set(data);
        }),
        update: vi.fn((docRef: any, data: any) => {
          return docRef.update(data);
        }),
        delete: vi.fn((docRef: any) => {
          return docRef.delete();
        }),
      };

      // Execute the transaction function
      return await updateFunction(transaction);
    }),
    _mockData: mockData,
  };

  return firestore;
};

describe("Actions", () => {
  let firestore: any;
  let schema: any;
  let runner: FunctionRunner<any>;

  beforeEach(() => {
    firestore = createMockFirestore();
    schema = defineSchema({
      users: defineTable({
        name: v.string(),
        email: v.string(),
        role: v.union(v.literal("admin"), v.literal("user")),
      }),
      posts: defineTable({
        userId: v.id("users"),
        title: v.string(),
        content: v.string(),
        published: v.boolean(),
      }),
      logs: defineTable({
        message: v.string(),
        timestamp: v.number(),
      }),
    });
    runner = new FunctionRunner(firestore, schema);
  });

  describe("internalAction", () => {
    it("should create an action definition", () => {
      const action = internalAction({
        args: { message: v.string() },
        handler: async (ctx, args) => {
          return { success: true, message: args.message };
        },
      });

      expect(action).toBeDefined();
      expect(action.isConvexFunction).toBe(true);
      expect(action.isAction).toBe(true);
      expect(action.isInternal).toBe(true);
    });

    it("should support action with no arguments", () => {
      const action = internalAction({
        args: {},
        handler: async (ctx) => {
          return "completed";
        },
      });

      expect(action).toBeDefined();
      expect(action._argsValidator).toBeDefined();
    });

    it("should support complex argument types", () => {
      const action = internalAction({
        args: {
          items: v.array(v.string()),
          metadata: v.object({
            source: v.string(),
            priority: v.number(),
          }),
        },
        handler: async (ctx, args) => {
          return { processed: args.items.length };
        },
      });

      expect(action._argsValidator).toBeDefined();
    });
  });

  describe("FunctionRunner.runAction", () => {
    it("should execute an action with valid arguments", async () => {
      const simpleAction = internalAction({
        args: { value: v.number() },
        handler: async (ctx, args) => {
          return args.value * 2;
        },
      });

      const result = await runner.runAction(simpleAction, { value: 21 });
      expect(result).toBe(42);
    });

    it("should provide action context without database access", async () => {
      let hasDbAccess = false;
      let hasRunQuery = false;
      let hasRunMutation = false;
      let hasRunAction = false;

      const testAction = internalAction({
        args: {},
        handler: async (ctx) => {
          hasDbAccess = "db" in ctx;
          hasRunQuery = typeof ctx.runQuery === "function";
          hasRunMutation = typeof ctx.runMutation === "function";
          hasRunAction = typeof ctx.runAction === "function";
          return true;
        },
      });

      await runner.runAction(testAction, {});

      expect(hasDbAccess).toBe(false); // Actions should NOT have direct db access
      expect(hasRunQuery).toBe(true);
      expect(hasRunMutation).toBe(true);
      expect(hasRunAction).toBe(true);
    });

    it("should call queries via ctx.runQuery", async () => {
      // Setup test data
      const userId = "user123";
      firestore._mockData[`users/${userId}`] = {
        name: "John Doe",
        email: "john@example.com",
        role: "user",
        _creationTime: Date.now(),
      };

      const getUserQuery = internalQuery({
        args: { userId: v.id("users") },
        handler: async (ctx, args) => {
          return await ctx.db.get(args.userId);
        },
      });

      const getUserAction = internalAction({
        args: { userId: v.id("users") },
        handler: async (ctx, args) => {
          const user = await ctx.runQuery(getUserQuery, { userId: args.userId });
          return user;
        },
      });

      const result = await runner.runAction(getUserAction, {
        userId: `users:${userId}`,
      });

      expect(result).toBeDefined();
      expect(result?.name).toBe("John Doe");
    });

    it("should call mutations via ctx.runMutation", async () => {
      const createUserMutation = internalMutation({
        args: {
          name: v.string(),
          email: v.string(),
        },
        handler: async (ctx, args) => {
          return await ctx.db.insert("users", {
            name: args.name,
            email: args.email,
            role: "user",
          });
        },
      });

      const registerUserAction = internalAction({
        args: {
          name: v.string(),
          email: v.string(),
        },
        handler: async (ctx, args) => {
          const userId = await ctx.runMutation(createUserMutation, {
            name: args.name,
            email: args.email,
          });
          return { userId, registered: true };
        },
      });

      const result = await runner.runAction(registerUserAction, {
        name: "Jane Doe",
        email: "jane@example.com",
      });

      expect(result.userId).toBeDefined();
      expect(result.userId).toMatch(/^users:/);
      expect(result.registered).toBe(true);
    });

    it("should call other actions via ctx.runAction", async () => {
      const logAction = internalAction({
        args: { message: v.string() },
        handler: async (ctx, args) => {
          return { logged: true, message: args.message };
        },
      });

      const processWithLoggingAction = internalAction({
        args: { data: v.string() },
        handler: async (ctx, args) => {
          await ctx.runAction(logAction, { message: `Processing: ${args.data}` });
          return { processed: args.data };
        },
      });

      const result = await runner.runAction(processWithLoggingAction, {
        data: "test data",
      });

      expect(result.processed).toBe("test data");
    });

    it("should perform side effects (simulating external API call)", async () => {
      let sideEffectExecuted = false;
      let apiCallMade = false;

      const fetchDataAction = internalAction({
        args: { url: v.string() },
        handler: async (ctx, args) => {
          // Simulate an external API call
          sideEffectExecuted = true;
          apiCallMade = args.url.includes("api.example.com");

          return {
            data: "fetched data",
            url: args.url,
          };
        },
      });

      const result = await runner.runAction(fetchDataAction, {
        url: "https://api.example.com/data",
      });

      expect(sideEffectExecuted).toBe(true);
      expect(apiCallMade).toBe(true);
      expect(result.data).toBe("fetched data");
    });

    it("should combine query, mutation, and side effects", async () => {
      // Setup test user
      const userId = "user123";
      firestore._mockData[`users/${userId}`] = {
        name: "John Doe",
        email: "john@example.com",
        role: "user",
        _creationTime: Date.now(),
      };

      const getUserQuery = internalQuery({
        args: { userId: v.id("users") },
        handler: async (ctx, args) => {
          return await ctx.db.get(args.userId);
        },
      });

      const createLogMutation = internalMutation({
        args: { message: v.string() },
        handler: async (ctx, args) => {
          return await ctx.db.insert("logs", {
            message: args.message,
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
          // 1. Read data via query
          const user = await ctx.runQuery(getUserQuery, { userId: args.userId });
          if (!user) throw new Error("User not found");

          // 2. Perform side effect (e.g., call external API)
          const externalResult = { processed: true, operation: args.operation };

          // 3. Write log via mutation
          await ctx.runMutation(createLogMutation, {
            message: `${args.operation} performed for user ${user.name}`,
          });

          return {
            user: user.name,
            result: externalResult,
          };
        },
      });

      const result = await runner.runAction(processUserAction, {
        userId: `users:${userId}`,
        operation: "email verification",
      });

      expect(result.user).toBe("John Doe");
      expect(result.result.processed).toBe(true);
    });

    it("should handle errors gracefully", async () => {
      const failingAction = internalAction({
        args: {},
        handler: async (ctx) => {
          throw new Error("Action failed");
        },
      });

      await expect(runner.runAction(failingAction, {})).rejects.toThrow("Action failed");
    });

    it("should validate action arguments", async () => {
      const strictAction = internalAction({
        args: {
          count: v.number(),
          email: v.string(),
        },
        handler: async (ctx, args) => {
          return { count: args.count, email: args.email };
        },
      });

      // This should work
      const result = await runner.runAction(strictAction, {
        count: 42,
        email: "test@example.com",
      });
      expect(result.count).toBe(42);

      // Invalid arguments should fail validation (in a real implementation)
      // For now, we're not doing runtime validation, but the types should catch this
    });

    it("should handle nested action calls", async () => {
      const innerAction = internalAction({
        args: { value: v.number() },
        handler: async (ctx, args) => {
          return args.value + 10;
        },
      });

      const middleAction = internalAction({
        args: { value: v.number() },
        handler: async (ctx, args) => {
          const result = await ctx.runAction(innerAction, { value: args.value });
          return result * 2;
        },
      });

      const outerAction = internalAction({
        args: { value: v.number() },
        handler: async (ctx, args) => {
          const result = await ctx.runAction(middleAction, { value: args.value });
          return result + 5;
        },
      });

      // (5 + 10) * 2 + 5 = 35
      const result = await runner.runAction(outerAction, { value: 5 });
      expect(result).toBe(35);
    });

    it("should propagate errors from nested queries in actions", async () => {
      const failingQuery = internalQuery({
        args: {},
        handler: async (ctx) => {
          throw new Error("Query failed");
        },
      });

      const actionWithFailingQuery = internalAction({
        args: {},
        handler: async (ctx) => {
          await ctx.runQuery(failingQuery, {});
          return "should not reach here";
        },
      });

      await expect(runner.runAction(actionWithFailingQuery, {})).rejects.toThrow(
        "Query failed"
      );
    });

    it("should propagate errors from nested mutations in actions", async () => {
      const failingMutation = internalMutation({
        args: {},
        handler: async (ctx) => {
          throw new Error("Mutation failed");
        },
      });

      const actionWithFailingMutation = internalAction({
        args: {},
        handler: async (ctx) => {
          await ctx.runMutation(failingMutation, {});
          return "should not reach here";
        },
      });

      await expect(runner.runAction(actionWithFailingMutation, {})).rejects.toThrow(
        "Mutation failed"
      );
    });

    it("should allow actions to return complex types", async () => {
      const complexAction = internalAction({
        args: {},
        handler: async (ctx) => {
          return {
            status: "success",
            data: {
              items: [1, 2, 3],
              metadata: {
                count: 3,
                source: "test",
              },
            },
            timestamp: Date.now(),
          };
        },
      });

      const result = await runner.runAction(complexAction, {});

      expect(result.status).toBe("success");
      expect(result.data.items).toEqual([1, 2, 3]);
      expect(result.data.metadata.count).toBe(3);
      expect(result.timestamp).toBeDefined();
    });

    it("should handle optional arguments", async () => {
      const optionalArgsAction = internalAction({
        args: {
          required: v.string(),
          optional: v.optional(v.number()),
        },
        handler: async (ctx, args) => {
          return {
            required: args.required,
            optional: args.optional ?? "not provided",
          };
        },
      });

      const result1 = await runner.runAction(optionalArgsAction, {
        required: "test",
        optional: 42,
      });
      expect(result1.optional).toBe(42);

      const result2 = await runner.runAction(optionalArgsAction, {
        required: "test",
      });
      expect(result2.optional).toBe("not provided");
    });
  });

  describe("Action isolation", () => {
    it("should not have direct database access", async () => {
      const actionAttemptingDbAccess = internalAction({
        args: {},
        handler: async (ctx) => {
          // TypeScript should prevent this, but let's verify at runtime
          const hasDb = "db" in ctx;
          return { hasDb };
        },
      });

      const result = await runner.runAction(actionAttemptingDbAccess, {});
      expect(result.hasDb).toBe(false);
    });

    it("should maintain transaction isolation when calling mutations", async () => {
      // Setup initial data
      const userId = "user123";
      firestore._mockData[`users/${userId}`] = {
        name: "John Doe",
        email: "john@example.com",
        role: "user",
        _creationTime: Date.now(),
      };

      const updateUserMutation = internalMutation({
        args: { userId: v.id("users"), name: v.string() },
        handler: async (ctx, args) => {
          await ctx.db.patch(args.userId, { name: args.name });
        },
      });

      const actionWithMultipleMutations = internalAction({
        args: { userId: v.id("users") },
        handler: async (ctx, args) => {
          // Each mutation runs in its own transaction
          await ctx.runMutation(updateUserMutation, {
            userId: args.userId,
            name: "Updated Name 1",
          });

          await ctx.runMutation(updateUserMutation, {
            userId: args.userId,
            name: "Updated Name 2",
          });

          return { updated: true };
        },
      });

      await runner.runAction(actionWithMultipleMutations, {
        userId: `users:${userId}`,
      });

      // Verify the final state
      const finalData = firestore._mockData[`users/${userId}`];
      expect(finalData.name).toBe("Updated Name 2");
    });
  });

  describe("Real-world action patterns", () => {
    it("should handle a notification sending pattern", async () => {
      const getUserQuery = internalQuery({
        args: { userId: v.id("users") },
        handler: async (ctx, args) => {
          return await ctx.db.get(args.userId);
        },
      });

      const logNotificationMutation = internalMutation({
        args: { userId: v.id("users"), message: v.string() },
        handler: async (ctx, args) => {
          return await ctx.db.insert("logs", {
            message: `Notification sent to user ${args.userId}: ${args.message}`,
            timestamp: Date.now(),
          });
        },
      });

      const sendNotificationAction = internalAction({
        args: {
          userId: v.id("users"),
          message: v.string(),
        },
        handler: async (ctx, args) => {
          // 1. Get user data
          const user = await ctx.runQuery(getUserQuery, { userId: args.userId });
          if (!user) throw new Error("User not found");

          // 2. Send notification (side effect - would call external service in real app)
          const notificationSent = true; // Mock external API call

          // 3. Log the notification
          await ctx.runMutation(logNotificationMutation, {
            userId: args.userId,
            message: args.message,
          });

          return {
            success: notificationSent,
            recipient: user.email,
          };
        },
      });

      const userId = "user123";
      firestore._mockData[`users/${userId}`] = {
        name: "John Doe",
        email: "john@example.com",
        role: "user",
        _creationTime: Date.now(),
      };

      const result = await runner.runAction(sendNotificationAction, {
        userId: `users:${userId}`,
        message: "Welcome to our app!",
      });

      expect(result.success).toBe(true);
      expect(result.recipient).toBe("john@example.com");
    });

    it("should handle a webhook processing pattern", async () => {
      const createLogMutation = internalMutation({
        args: { message: v.string() },
        handler: async (ctx, args) => {
          return await ctx.db.insert("logs", {
            message: args.message,
            timestamp: Date.now(),
          });
        },
      });

      const processWebhookAction = internalAction({
        args: {
          event: v.string(),
          payload: v.object({
            data: v.string(),
          }),
        },
        handler: async (ctx, args) => {
          // 1. Validate webhook (side effect - might call external service)
          const isValid = true;

          // 2. Process the event
          const processed = {
            event: args.event,
            data: args.payload.data,
            processedAt: Date.now(),
          };

          // 3. Log the webhook
          await ctx.runMutation(createLogMutation, {
            message: `Webhook received: ${args.event}`,
          });

          return {
            success: isValid,
            processed,
          };
        },
      });

      const result = await runner.runAction(processWebhookAction, {
        event: "payment.success",
        payload: { data: "payment_123" },
      });

      expect(result.success).toBe(true);
      expect(result.processed.event).toBe("payment.success");
    });
  });
});

