import { describe, it, expect, beforeEach, vi } from "vitest";
import { internalQuery, internalMutation, FunctionRunner } from "../../src/functions";
import { defineSchema, defineTable } from "../../src/schema";
import * as v from "../../src/validators";

// Mock Firestore setup
const createMockFirestore = () => {
  const mockData: Record<string, any> = {};

  return {
    collection: vi.fn((name: string) => ({
      doc: vi.fn((id?: string) => {
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
      }),
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
    _mockData: mockData,
  };
};

describe("Functions", () => {
  let firestore: any;
  let schema: any;

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
    });
  });

  describe("internalQuery", () => {
    it("should create a query definition", () => {
      const query = internalQuery({
        args: { userId: v.id("users") },
        handler: async (ctx, args) => {
          return await ctx.db.get(args.userId);
        },
      });

      expect(query).toBeDefined();
      expect(query._type).toBe("query");
      expect(query.args).toBeDefined();
      expect(query.handler).toBeDefined();
    });

    it("should support multiple arguments", () => {
      const query = internalQuery({
        args: {
          userId: v.id("users"),
          limit: v.number(),
          includeUnpublished: v.boolean(),
        },
        handler: async (ctx, args) => {
          return [];
        },
      });

      expect(query.args).toHaveProperty("userId");
      expect(query.args).toHaveProperty("limit");
      expect(query.args).toHaveProperty("includeUnpublished");
    });

    it("should support optional arguments", () => {
      const query = internalQuery({
        args: {
          userId: v.id("users"),
          search: v.optional(v.string()),
        },
        handler: async (ctx, args) => {
          return [];
        },
      });

      expect(query.args).toHaveProperty("search");
    });
  });

  describe("internalMutation", () => {
    it("should create a mutation definition", () => {
      const mutation = internalMutation({
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

      expect(mutation).toBeDefined();
      expect(mutation._type).toBe("mutation");
      expect(mutation.args).toBeDefined();
      expect(mutation.handler).toBeDefined();
    });

    it("should support complex argument types", () => {
      const mutation = internalMutation({
        args: {
          userId: v.id("users"),
          tags: v.array(v.string()),
          metadata: v.object({
            source: v.string(),
            priority: v.number(),
          }),
        },
        handler: async (ctx, args) => {
          return "success";
        },
      });

      expect(mutation.args).toHaveProperty("userId");
      expect(mutation.args).toHaveProperty("tags");
      expect(mutation.args).toHaveProperty("metadata");
    });
  });

  describe("FunctionRunner", () => {
    let runner: FunctionRunner<any>;

    beforeEach(() => {
      runner = new FunctionRunner(firestore, schema);
    });

    describe("runQuery", () => {
      it("should execute a query with valid arguments", async () => {
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

        const result = await runner.runQuery(getUserQuery, {
          userId: `users:${userId}`,
        });

        expect(result).toBeDefined();
        expect(result?.name).toBe("John Doe");
      });

      it("should validate query arguments", async () => {
        const getUserQuery = internalQuery({
          args: { userId: v.id("users") },
          handler: async (ctx, args) => {
            return await ctx.db.get(args.userId);
          },
        });

        await expect(runner.runQuery(getUserQuery, { userId: 123 })).rejects.toThrow();
      });

      it("should handle optional arguments", async () => {
        const searchQuery = internalQuery({
          args: {
            search: v.optional(v.string()),
          },
          handler: async (ctx, args) => {
            return { searched: args.search };
          },
        });

        const result1 = await runner.runQuery(searchQuery, {
          search: "test",
        });
        expect(result1.searched).toBe("test");

        const result2 = await runner.runQuery(searchQuery, {});
        expect(result2.searched).toBeUndefined();
      });

      it("should provide database context to handler", async () => {
        let contextProvided = false;

        const testQuery = internalQuery({
          args: {},
          handler: async (ctx) => {
            contextProvided = ctx.db !== undefined;
            return true;
          },
        });

        await runner.runQuery(testQuery, {});
        expect(contextProvided).toBe(true);
      });
    });

    describe("runMutation", () => {
      it("should execute a mutation with valid arguments", async () => {
        const createUserMutation = internalMutation({
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
            });
          },
        });

        const result = await runner.runMutation(createUserMutation, {
          name: "Jane Doe",
          email: "jane@example.com",
          role: "admin",
        });

        expect(result).toBeDefined();
        expect(result).toMatch(/^users:/);
      });

      it("should validate mutation arguments", async () => {
        const createUserMutation = internalMutation({
          args: {
            name: v.string(),
            email: v.string(),
          },
          handler: async (ctx, args) => {
            return "success";
          },
        });

        await expect(
          runner.runMutation(createUserMutation, {
            name: "Jane Doe",
            email: 123, // Invalid type
          })
        ).rejects.toThrow();
      });

      it("should provide database write context to handler", async () => {
        let canInsert = false;
        let canPatch = false;
        let canDelete = false;

        const testMutation = internalMutation({
          args: {},
          handler: async (ctx) => {
            canInsert = typeof ctx.db.insert === "function";
            canPatch = typeof ctx.db.patch === "function";
            canDelete = typeof ctx.db.delete === "function";
            return true;
          },
        });

        await runner.runMutation(testMutation, {});
        expect(canInsert).toBe(true);
        expect(canPatch).toBe(true);
        expect(canDelete).toBe(true);
      });

      it("should handle complex mutations", async () => {
        // First create a user
        firestore._mockData["users/user123"] = {
          name: "John Doe",
          email: "john@example.com",
          role: "user",
          _creationTime: Date.now(),
        };

        const createPostMutation = internalMutation({
          args: {
            userId: v.id("users"),
            title: v.string(),
            content: v.string(),
          },
          handler: async (ctx, args) => {
            const user = await ctx.db.get(args.userId);
            if (!user) throw new Error("User not found");

            return await ctx.db.insert("posts", {
              userId: args.userId,
              title: args.title,
              content: args.content,
              published: false,
            });
          },
        });

        const result = await runner.runMutation(createPostMutation, {
          userId: "users:user123",
          title: "My First Post",
          content: "Hello World!",
        });

        expect(result).toBeDefined();
        expect(result).toMatch(/^posts:/);
      });
    });

    describe("getSchema", () => {
      it("should return the schema", () => {
        const returnedSchema = runner.getSchema();
        expect(returnedSchema).toBe(schema);
      });
    });
  });

  describe("Error Handling", () => {
    let runner: FunctionRunner<any>;

    beforeEach(() => {
      runner = new FunctionRunner(firestore, schema);
    });

    it("should propagate errors from query handlers", async () => {
      const failingQuery = internalQuery({
        args: {},
        handler: async () => {
          throw new Error("Query failed");
        },
      });

      await expect(runner.runQuery(failingQuery, {})).rejects.toThrow("Query failed");
    });

    it("should propagate errors from mutation handlers", async () => {
      const failingMutation = internalMutation({
        args: {},
        handler: async () => {
          throw new Error("Mutation failed");
        },
      });

      await expect(runner.runMutation(failingMutation, {})).rejects.toThrow("Mutation failed");
    });

    it("should handle validation errors gracefully", async () => {
      const strictQuery = internalQuery({
        args: {
          age: v.number(),
        },
        handler: async (ctx, args) => {
          return args.age;
        },
      });

      await expect(runner.runQuery(strictQuery, { age: "not a number" })).rejects.toThrow();
    });
  });
});
