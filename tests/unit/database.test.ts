import { describe, it, expect, beforeEach, vi } from "vitest";
import { Database } from "../../src/database";
import { defineSchema, defineTable } from "../../src/schema";
import * as v from "../../src/validators";

// Mock Firestore
const mockFirestore = () => {
  const mockDocs: Record<string, any> = {};
  const mockCollections: Record<string, any> = {};

  return {
    collection: vi.fn((name: string) => {
      if (!mockCollections[name]) {
        mockCollections[name] = {
          doc: vi.fn((id?: string) => {
            const docId = id || `doc_${Date.now()}`;
            return {
              id: docId,
              get: vi.fn(async () => ({
                exists: !!mockDocs[`${name}/${docId}`],
                id: docId,
                data: () => mockDocs[`${name}/${docId}`],
              })),
              set: vi.fn(async (data: any) => {
                mockDocs[`${name}/${docId}`] = data;
              }),
              update: vi.fn(async (data: any) => {
                if (mockDocs[`${name}/${docId}`]) {
                  mockDocs[`${name}/${docId}`] = {
                    ...mockDocs[`${name}/${docId}`],
                    ...data,
                  };
                }
              }),
              delete: vi.fn(async () => {
                delete mockDocs[`${name}/${docId}`];
              }),
            };
          }),
          where: vi.fn(() => ({
            where: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            get: vi.fn(async () => ({
              docs: [],
            })),
          })),
        };
      }
      return mockCollections[name];
    }),
    _mockDocs: mockDocs,
  };
};

describe("Database", () => {
  let db: Database<any>;
  let firestore: any;
  let schema: any;

  beforeEach(() => {
    firestore = mockFirestore();
    schema = defineSchema({
      users: defineTable({
        name: v.string(),
        email: v.string(),
        age: v.optional(v.number()),
      }),
      posts: defineTable({
        userId: v.id("users"),
        title: v.string(),
        content: v.string(),
      }),
    });
    db = new Database(firestore, schema);
  });

  describe("insert", () => {
    it("should insert a document", async () => {
      const id = await db.insert("users", {
        name: "John Doe",
        email: "john@example.com",
      });

      expect(id).toMatch(/^users:/);
      expect(firestore.collection).toHaveBeenCalledWith("users");
    });

    it("should validate document before inserting", async () => {
      await expect(
        db.insert("users", {
          name: "John Doe",
          email: 123, // Invalid type
        } as any)
      ).rejects.toThrow();
    });

    it("should add _creationTime to inserted document", async () => {
      const beforeTime = Date.now();
      const id = await db.insert("users", {
        name: "John Doe",
        email: "john@example.com",
      });
      const afterTime = Date.now();

      expect(id).toMatch(/^users:/);

      // Check that document was created with _creationTime
      const docId = id.split(":")[1];
      const insertedData = firestore._mockDocs[`users/${docId}`];
      expect(insertedData).toBeDefined();
      expect(insertedData._creationTime).toBeGreaterThanOrEqual(beforeTime);
      expect(insertedData._creationTime).toBeLessThanOrEqual(afterTime);
    });
  });

  describe("get", () => {
    it("should retrieve a document by ID", async () => {
      const docId = "user123";
      const data = {
        name: "John Doe",
        email: "john@example.com",
        _creationTime: Date.now(),
      };
      firestore._mockDocs[`users/${docId}`] = data;

      const result = await db.get(`users:${docId}` as any);

      expect(result).toBeDefined();
      expect(result?.name).toBe("John Doe");
      expect(result?._id).toBe(`users:${docId}`);
    });

    it("should return null for non-existent document", async () => {
      const result = await db.get("users:nonexistent" as any);
      expect(result).toBeNull();
    });

    it("should parse ID correctly", async () => {
      const docId = "user123";
      firestore._mockDocs[`users/${docId}`] = {
        name: "John",
        email: "john@test.com",
        _creationTime: Date.now(),
      };

      await db.get(`users:${docId}` as any);

      expect(firestore.collection).toHaveBeenCalledWith("users");
    });

    it("should throw error for invalid ID format", async () => {
      await expect(db.get("invalid-id" as any)).rejects.toThrow("Invalid ID format");
    });
  });

  describe("patch", () => {
    it("should update document fields", async () => {
      const docId = "user123";
      const originalData = {
        name: "John Doe",
        email: "john@example.com",
        _creationTime: Date.now(),
      };
      firestore._mockDocs[`users/${docId}`] = { ...originalData };

      await db.patch(`users:${docId}` as any, {
        email: "newemail@example.com",
      });

      // Verify the document was updated
      const updatedData = firestore._mockDocs[`users/${docId}`];
      expect(updatedData.email).toBe("newemail@example.com");
      expect(updatedData.name).toBe("John Doe"); // Other fields preserved
    });
  });

  describe("replace", () => {
    it("should replace entire document", async () => {
      const docId = "user123";
      const creationTime = 1000;
      firestore._mockDocs[`users/${docId}`] = {
        name: "John Doe",
        email: "john@example.com",
        _creationTime: creationTime,
      };

      await db.replace(`users:${docId}` as any, {
        name: "Jane Doe",
        email: "jane@example.com",
      });

      // Verify the document was replaced
      const replacedData = firestore._mockDocs[`users/${docId}`];
      expect(replacedData.name).toBe("Jane Doe");
      expect(replacedData.email).toBe("jane@example.com");
      expect(replacedData._creationTime).toBe(creationTime); // Preserved
    });
  });

  describe("delete", () => {
    it("should delete a document", async () => {
      const docId = "user123";
      firestore._mockDocs[`users/${docId}`] = {
        name: "John Doe",
        email: "john@example.com",
      };

      await db.delete(`users:${docId}` as any);

      // Verify the document was deleted
      expect(firestore._mockDocs[`users/${docId}`]).toBeUndefined();
    });
  });

  describe("query", () => {
    it("should create a query builder", () => {
      const query = db.query("users");
      expect(query).toBeDefined();
      expect(typeof query.where).toBe("function");
      expect(typeof query.order).toBe("function");
      expect(typeof query.limit).toBe("function");
    });

    it("should support method chaining", () => {
      const query = db.query("users").where("age", ">", 18).order("name", "asc").limit(10);

      expect(query).toBeDefined();
    });
  });

  describe("createId", () => {
    it("should create properly formatted ID", () => {
      const id = db.createId("users", "123");
      expect(id).toBe("users:123");
    });
  });
});
