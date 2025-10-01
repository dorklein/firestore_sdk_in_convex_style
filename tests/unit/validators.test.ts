import { describe, it, expect } from "vitest";
import * as v from "../../src/validators";
import * as valibot from "valibot";

describe("Validators", () => {
  describe("v.string()", () => {
    it("should create a string validator", () => {
      const validator = v.string();
      expect(validator._schema).toBeDefined();
      expect(valibot.parse(validator._schema, "hello")).toBe("hello");
    });

    it("should reject non-string values", () => {
      const validator = v.string();
      expect(() => valibot.parse(validator._schema, 123)).toThrow();
      expect(() => valibot.parse(validator._schema, null)).toThrow();
    });
  });

  describe("v.number()", () => {
    it("should create a number validator", () => {
      const validator = v.number();
      expect(validator._schema).toBeDefined();
      expect(valibot.parse(validator._schema, 42)).toBe(42);
    });

    it("should reject non-number values", () => {
      const validator = v.number();
      expect(() => valibot.parse(validator._schema, "123")).toThrow();
    });
  });

  describe("v.boolean()", () => {
    it("should create a boolean validator", () => {
      const validator = v.boolean();
      expect(validator._schema).toBeDefined();
      expect(valibot.parse(validator._schema, true)).toBe(true);
      expect(valibot.parse(validator._schema, false)).toBe(false);
    });
  });

  describe("v.optional()", () => {
    it("should create an optional validator", () => {
      const validator = v.optional(v.string());
      expect(valibot.parse(validator._schema, "hello")).toBe("hello");
      expect(valibot.parse(validator._schema, undefined)).toBeUndefined();
    });

    it("should reject invalid values", () => {
      const validator = v.optional(v.string());
      expect(() => valibot.parse(validator._schema, 123)).toThrow();
    });
  });

  describe("v.array()", () => {
    it("should create an array validator", () => {
      const validator = v.array(v.string());
      const result = valibot.parse(validator._schema, ["hello", "world"]);
      expect(result).toEqual(["hello", "world"]);
    });

    it("should reject non-array values", () => {
      const validator = v.array(v.string());
      expect(() => valibot.parse(validator._schema, "not an array")).toThrow();
    });

    it("should reject arrays with invalid items", () => {
      const validator = v.array(v.string());
      expect(() => valibot.parse(validator._schema, ["hello", 123])).toThrow();
    });
  });

  describe("v.object()", () => {
    it("should create an object validator", () => {
      const validator = v.object({
        name: v.string(),
        age: v.number(),
      });
      const result = valibot.parse(validator._schema, {
        name: "John",
        age: 30,
      });
      expect(result).toEqual({ name: "John", age: 30 });
    });

    it("should handle optional fields", () => {
      const validator = v.object({
        name: v.string(),
        age: v.optional(v.number()),
      });
      const result = valibot.parse(validator._schema, { name: "John" });
      expect(result).toEqual({ name: "John" });
    });
  });

  describe("v.union()", () => {
    it("should create a union validator", () => {
      const validator = v.union(v.literal("admin"), v.literal("user"));
      expect(valibot.parse(validator._schema, "admin")).toBe("admin");
      expect(valibot.parse(validator._schema, "user")).toBe("user");
    });

    it("should reject values not in the union", () => {
      const validator = v.union(v.literal("admin"), v.literal("user"));
      expect(() => valibot.parse(validator._schema, "guest")).toThrow();
    });
  });

  describe("v.picklist()", () => {
    it("should create a picklist validator with string options", () => {
      const validator = v.picklist(["admin", "user", "guest"]);
      expect(valibot.parse(validator._schema, "admin")).toBe("admin");
      expect(valibot.parse(validator._schema, "user")).toBe("user");
      expect(valibot.parse(validator._schema, "guest")).toBe("guest");
    });

    it("should reject values not in the picklist", () => {
      const validator = v.picklist(["admin", "user"]);
      expect(() => valibot.parse(validator._schema, "guest")).toThrow();
      expect(() => valibot.parse(validator._schema, "superuser")).toThrow();
    });

    it("should work with role-based access control", () => {
      const validator = v.picklist(["read", "write", "delete"]);
      expect(valibot.parse(validator._schema, "read")).toBe("read");
      expect(valibot.parse(validator._schema, "write")).toBe("write");
      expect(valibot.parse(validator._schema, "delete")).toBe("delete");
    });

    it("should reject non-string values", () => {
      const validator = v.picklist(["active", "inactive"]);
      expect(() => valibot.parse(validator._schema, 123)).toThrow();
      expect(() => valibot.parse(validator._schema, true)).toThrow();
      expect(() => valibot.parse(validator._schema, null)).toThrow();
    });

    it("should work with status values", () => {
      const validator = v.picklist(["pending", "approved", "rejected"]);
      expect(valibot.parse(validator._schema, "pending")).toBe("pending");
      expect(valibot.parse(validator._schema, "approved")).toBe("approved");
      expect(valibot.parse(validator._schema, "rejected")).toBe("rejected");
    });
  });

  describe("v.literal()", () => {
    it("should create a literal validator", () => {
      const validator = v.literal("admin");
      expect(valibot.parse(validator._schema, "admin")).toBe("admin");
    });

    it("should reject other values", () => {
      const validator = v.literal("admin");
      expect(() => valibot.parse(validator._schema, "user")).toThrow();
    });
  });

  describe("v.id()", () => {
    it("should create a document ID validator", () => {
      const validator = v.id("users");
      const id = "users:123";
      expect(valibot.parse(validator._schema, id)).toBe(id);
    });

    it("should validate correct ID format", () => {
      const validator = v.id("users");
      expect(valibot.parse(validator._schema, "users:abc123")).toBe("users:abc123");
    });

    it("should reject invalid ID format", () => {
      const validator = v.id("users");
      // Note: Basic string validation - more complex validation would be runtime
      expect(() => valibot.parse(validator._schema, 123)).toThrow();
      expect(() => valibot.parse(validator._schema, null)).toThrow();
    });

    it("should accept valid ID format", () => {
      const validator = v.id("users");
      // IDs are strings in the format "table:id"
      expect(valibot.parse(validator._schema, "users:123")).toBe("users:123");
    });
  });

  describe("v.record()", () => {
    it("should create a record validator with string keys and string values", () => {
      const validator = v.record(v.string(), v.string());
      const result = valibot.parse(validator._schema, {
        key1: "value1",
        key2: "value2",
      });
      expect(result).toEqual({ key1: "value1", key2: "value2" });
    });

    it("should create a record validator with string keys and number values", () => {
      const validator = v.record(v.string(), v.number());
      const result = valibot.parse(validator._schema, {
        age: 30,
        count: 100,
      });
      expect(result).toEqual({ age: 30, count: 100 });
    });

    it("should create a record validator with string keys and object values", () => {
      const validator = v.record(
        v.string(),
        v.object({
          name: v.string(),
          age: v.number(),
        })
      );
      const result = valibot.parse(validator._schema, {
        user1: { name: "John", age: 30 },
        user2: { name: "Jane", age: 25 },
      });
      expect(result).toEqual({
        user1: { name: "John", age: 30 },
        user2: { name: "Jane", age: 25 },
      });
    });

    it("should accept an empty record", () => {
      const validator = v.record(v.string(), v.number());
      const result = valibot.parse(validator._schema, {});
      expect(result).toEqual({});
    });

    it("should reject non-object values", () => {
      const validator = v.record(v.string(), v.string());
      expect(() => valibot.parse(validator._schema, "not an object")).toThrow();
      expect(() => valibot.parse(validator._schema, 123)).toThrow();
      expect(() => valibot.parse(validator._schema, null)).toThrow();
    });

    it("should reject records with invalid value types", () => {
      const validator = v.record(v.string(), v.number());
      expect(() =>
        valibot.parse(validator._schema, {
          key1: 123,
          key2: "invalid", // should be number
        })
      ).toThrow();
    });

    it("should work with nested records", () => {
      const validator = v.record(v.string(), v.record(v.string(), v.number()));
      const result = valibot.parse(validator._schema, {
        category1: { item1: 10, item2: 20 },
        category2: { item3: 30 },
      });
      expect(result).toEqual({
        category1: { item1: 10, item2: 20 },
        category2: { item3: 30 },
      });
    });

    it("should work with optional values", () => {
      const validator = v.record(v.string(), v.optional(v.number()));
      const result = valibot.parse(validator._schema, {
        key1: 123,
        key2: undefined,
      });
      expect(result).toEqual({ key1: 123, key2: undefined });
    });
  });

  describe("v.any()", () => {
    it("should accept any value", () => {
      const validator = v.any();
      expect(valibot.parse(validator._schema, "string")).toBe("string");
      expect(valibot.parse(validator._schema, 123)).toBe(123);
      expect(valibot.parse(validator._schema, { foo: "bar" })).toEqual({ foo: "bar" });
    });
  });
});
