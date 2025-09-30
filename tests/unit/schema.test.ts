import { describe, it, expect } from "vitest";
import { defineTable, defineSchema } from "../../src/schema";
import * as v from "../../src/validators";

describe("Schema Definition", () => {
  describe("defineTable", () => {
    it("should create a table definition", () => {
      const table = defineTable({
        name: v.string(),
        age: v.number(),
      });

      expect(table).toBeDefined();
      expect(typeof table.index).toBe("function");
      expect(typeof table.build).toBe("function");
    });

    it("should build a table without indexes", () => {
      const table = defineTable({
        name: v.string(),
        age: v.number(),
      }).build();

      expect(table.fields).toHaveProperty("name");
      expect(table.fields).toHaveProperty("age");
      expect(table.indexes).toEqual([]);
    });

    it("should add indexes to table", () => {
      const table = defineTable({
        name: v.string(),
        email: v.string(),
      })
        .index("by_name", ["name"])
        .index("by_email", ["email"])
        .build();

      expect(table.indexes).toHaveLength(2);
      expect(table.indexes[0]).toEqual({ name: "by_name", fields: ["name"] });
      expect(table.indexes[1]).toEqual({ name: "by_email", fields: ["email"] });
    });

    it("should support compound indexes", () => {
      const table = defineTable({
        userId: v.string(),
        createdAt: v.number(),
      })
        .index("by_user_and_date", ["userId", "createdAt"])
        .build();

      expect(table.indexes).toHaveLength(1);
      expect(table.indexes[0].fields).toEqual(["userId", "createdAt"]);
    });

    it("should support optional fields", () => {
      const table = defineTable({
        name: v.string(),
        nickname: v.optional(v.string()),
      }).build();

      expect(table.fields).toHaveProperty("name");
      expect(table.fields).toHaveProperty("nickname");
    });

    it("should support complex field types", () => {
      const table = defineTable({
        tags: v.array(v.string()),
        metadata: v.object({
          source: v.string(),
          count: v.number(),
        }),
        status: v.union(v.literal("active"), v.literal("inactive")),
      }).build();

      expect(table.fields).toHaveProperty("tags");
      expect(table.fields).toHaveProperty("metadata");
      expect(table.fields).toHaveProperty("status");
    });
  });

  describe("defineSchema", () => {
    it("should create a schema with tables", () => {
      const schema = defineSchema({
        users: defineTable({
          name: v.string(),
          email: v.string(),
        }),
        posts: defineTable({
          title: v.string(),
          content: v.string(),
        }),
      });

      expect(schema).toBeDefined();
      expect(schema.tables).toHaveProperty("users");
      expect(schema.tables).toHaveProperty("posts");
    });

    it("should convert table builders to definitions", () => {
      const schema = defineSchema({
        users: defineTable({
          name: v.string(),
        }).index("by_name", ["name"]),
      });

      const usersTable = schema.getTable("users");
      expect(usersTable).toBeDefined();
      expect(usersTable?.indexes).toHaveLength(1);
    });

    it("should validate documents against schema", () => {
      const schema = defineSchema({
        users: defineTable({
          name: v.string(),
          age: v.number(),
        }),
      });

      const validDoc = { name: "John", age: 30 };
      const validated = schema.validateDocument("users", validDoc);
      expect(validated).toEqual(validDoc);
    });

    it("should reject invalid documents", () => {
      const schema = defineSchema({
        users: defineTable({
          name: v.string(),
          age: v.number(),
        }),
      });

      const invalidDoc = { name: "John", age: "thirty" };
      expect(() => schema.validateDocument("users", invalidDoc)).toThrow();
    });

    it("should throw error for non-existent table", () => {
      const schema = defineSchema({
        users: defineTable({
          name: v.string(),
        }),
      });

      expect(() => schema.validateDocument("posts", { title: "Test" })).toThrow(
        "Table posts not found in schema"
      );
    });

    it("should handle optional fields in validation", () => {
      const schema = defineSchema({
        users: defineTable({
          name: v.string(),
          nickname: v.optional(v.string()),
        }),
      });

      const docWithOptional = { name: "John", nickname: "Johnny" };
      const docWithoutOptional = { name: "John" };

      expect(schema.validateDocument("users", docWithOptional)).toEqual(docWithOptional);
      expect(schema.validateDocument("users", docWithoutOptional)).toEqual(docWithoutOptional);
    });

    it("should validate complex nested structures", () => {
      const schema = defineSchema({
        users: defineTable({
          name: v.string(),
          metadata: v.object({
            source: v.string(),
            tags: v.array(v.string()),
          }),
        }),
      });

      const doc = {
        name: "John",
        metadata: {
          source: "web",
          tags: ["premium", "verified"],
        },
      };

      const validated = schema.validateDocument("users", doc);
      expect(validated).toEqual(doc);
    });

    it("should validate document IDs", () => {
      const schema = defineSchema({
        posts: defineTable({
          userId: v.id("users"),
          title: v.string(),
        }),
      });

      const doc = {
        userId: "users:123",
        title: "My Post",
      };

      const validated = schema.validateDocument("posts", doc);
      expect(validated).toEqual(doc);
    });

    it("should validate document with IDs", () => {
      const schema = defineSchema({
        posts: defineTable({
          userId: v.id("users"),
          title: v.string(),
        }),
      });

      const doc = {
        userId: "users:123",
        title: "My Post",
      };

      // Should not throw with valid ID format
      const validated = schema.validateDocument("posts", doc);
      expect(validated).toEqual(doc);
    });
  });

  describe("Schema getTable", () => {
    it("should return table definition", () => {
      const schema = defineSchema({
        users: defineTable({
          name: v.string(),
        }),
      });

      const table = schema.getTable("users");
      expect(table).toBeDefined();
      expect(table?.fields).toHaveProperty("name");
    });

    it("should return undefined for non-existent table", () => {
      const schema = defineSchema({
        users: defineTable({
          name: v.string(),
        }),
      });

      const table = schema.getTable("posts");
      expect(table).toBeUndefined();
    });
  });
});
