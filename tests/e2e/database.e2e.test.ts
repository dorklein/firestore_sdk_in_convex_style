import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Database } from "../../src/server/database";
import { defineSchema, defineTable } from "../../src/server/schema";
import * as v from "../../src/validators";
import {
  initializeFirebaseEmulator,
  clearFirestoreData,
  cleanupFirebase,
  isEmulatorRunning,
} from "./helpers/emulator";
import type { Firestore } from "firebase-admin/firestore";

describe("E2E Database Tests with Firebase Emulator", () => {
  let firestore: Firestore;
  let db: Database<any>;

  const schema = defineSchema({
    users: defineTable({
      name: v.string(),
      email: v.string(),
      age: v.optional(v.number()),
      role: v.union(v.literal("admin"), v.literal("user")),
    }),
    posts: defineTable({
      userId: v.id("users"),
      title: v.string(),
      content: v.string(),
      published: v.boolean(),
      views: v.number(),
    }),
  });

  beforeAll(async () => {
    // Check if emulator is running
    const emulatorRunning = await isEmulatorRunning();
    if (!emulatorRunning) {
      throw new Error(
        "Firebase Emulator is not running! Please start it with: pnpm emulator:start"
      );
    }

    firestore = initializeFirebaseEmulator();
    db = new Database(firestore, schema);
  });

  beforeEach(async () => {
    // Clear all data before each test
    await clearFirestoreData(firestore);
  });

  afterAll(async () => {
    await cleanupFirebase();
  });

  describe("Insert Operations", () => {
    it("should insert a document and retrieve it", async () => {
      const userId = await db.insert("users", {
        name: "John Doe",
        email: "john@example.com",
        role: "user",
      });

      expect(userId).toMatch(/^users:/);

      const user = await db.get(userId);
      expect(user).toBeDefined();
      expect(user?.name).toBe("John Doe");
      expect(user?.email).toBe("john@example.com");
      expect(user?.role).toBe("user");
      expect(user?._id).toBe(userId);
      expect(user?._creationTime).toBeGreaterThan(0);
    });

    it("should insert multiple documents", async () => {
      const user1Id = await db.insert("users", {
        name: "Alice",
        email: "alice@example.com",
        role: "admin",
      });

      const user2Id = await db.insert("users", {
        name: "Bob",
        email: "bob@example.com",
        role: "user",
      });

      expect(user1Id).not.toBe(user2Id);

      const user1 = await db.get(user1Id);
      const user2 = await db.get(user2Id);

      expect(user1?.name).toBe("Alice");
      expect(user2?.name).toBe("Bob");
    });

    it("should insert with optional fields", async () => {
      const userId = await db.insert("users", {
        name: "Jane",
        email: "jane@example.com",
        age: 30,
        role: "user",
      });

      const user = await db.get(userId);
      expect(user?.age).toBe(30);
    });

    it("should insert without optional fields", async () => {
      const userId = await db.insert("users", {
        name: "Tom",
        email: "tom@example.com",
        role: "user",
      });

      const user = await db.get(userId);
      expect(user?.age).toBeUndefined();
    });

    it("should validate data before inserting", async () => {
      await expect(
        db.insert("users", {
          name: "Invalid",
          email: 123, // Wrong type
          role: "user",
        } as any)
      ).rejects.toThrow();
    });
  });

  describe("Get Operations", () => {
    it("should return null for non-existent document", async () => {
      const result = await db.get("users:nonexistent" as any);
      expect(result).toBeNull();
    });

    it("should retrieve document with all fields", async () => {
      const userId = await db.insert("users", {
        name: "Test User",
        email: "test@example.com",
        age: 25,
        role: "admin",
      });

      const user = await db.get(userId);
      expect(user).toMatchObject({
        name: "Test User",
        email: "test@example.com",
        age: 25,
        role: "admin",
        _id: userId,
      });
    });
  });

  describe("Patch Operations", () => {
    it("should update specific fields", async () => {
      const userId = await db.insert("users", {
        name: "Original Name",
        email: "original@example.com",
        role: "user",
      });

      await db.patch(userId, {
        name: "Updated Name",
      });

      const user = await db.get(userId);
      expect(user?.name).toBe("Updated Name");
      expect(user?.email).toBe("original@example.com"); // Unchanged
    });

    it("should update multiple fields", async () => {
      const userId = await db.insert("users", {
        name: "John",
        email: "john@example.com",
        role: "user",
      });

      await db.patch(userId, {
        name: "Jane",
        email: "jane@example.com",
        age: 28,
      });

      const user = await db.get(userId);
      expect(user?.name).toBe("Jane");
      expect(user?.email).toBe("jane@example.com");
      expect(user?.age).toBe(28);
    });

    it("should not affect _creationTime", async () => {
      const userId = await db.insert("users", {
        name: "Test",
        email: "test@example.com",
        role: "user",
      });

      const originalUser = await db.get(userId);
      const originalCreationTime = originalUser?._creationTime;

      await db.patch(userId, { name: "Updated" });

      const updatedUser = await db.get(userId);
      expect(updatedUser?._creationTime).toBe(originalCreationTime);
    });
  });

  describe("Replace Operations", () => {
    it("should replace entire document", async () => {
      const userId = await db.insert("users", {
        name: "Original",
        email: "original@example.com",
        age: 25,
        role: "user",
      });

      await db.replace(userId, {
        name: "Replaced",
        email: "replaced@example.com",
        role: "admin",
      });

      const user = await db.get(userId);
      expect(user?.name).toBe("Replaced");
      expect(user?.email).toBe("replaced@example.com");
      expect(user?.age).toBeUndefined(); // Removed
      expect(user?.role).toBe("admin");
    });

    it("should preserve _creationTime", async () => {
      const userId = await db.insert("users", {
        name: "Test",
        email: "test@example.com",
        role: "user",
      });

      const originalUser = await db.get(userId);
      const originalCreationTime = originalUser?._creationTime;

      await db.replace(userId, {
        name: "New Name",
        email: "new@example.com",
        role: "admin",
      });

      const replacedUser = await db.get(userId);
      expect(replacedUser?._creationTime).toBe(originalCreationTime);
    });
  });

  describe("Delete Operations", () => {
    it("should delete a document", async () => {
      const userId = await db.insert("users", {
        name: "To Delete",
        email: "delete@example.com",
        role: "user",
      });

      // Verify it exists
      let user = await db.get(userId);
      expect(user).toBeDefined();

      // Delete it
      await db.delete(userId);

      // Verify it's gone
      user = await db.get(userId);
      expect(user).toBeNull();
    });
  });

  describe("Query Operations", () => {
    beforeEach(async () => {
      // Insert test data
      await db.insert("users", {
        name: "Alice",
        email: "alice@example.com",
        age: 25,
        role: "admin",
      });

      await db.insert("users", {
        name: "Bob",
        email: "bob@example.com",
        age: 30,
        role: "user",
      });

      await db.insert("users", {
        name: "Charlie",
        email: "charlie@example.com",
        age: 35,
        role: "user",
      });

      await db.insert("users", {
        name: "Diana",
        email: "diana@example.com",
        role: "admin",
      });
    });

    it("should query all documents", async () => {
      const users = await db.query("users").collect();
      expect(users).toHaveLength(4);
    });

    it("should filter with where clause", async () => {
      const admins = await db.query("users").where("role", "==", "admin").collect();

      expect(admins).toHaveLength(2);
      expect(admins.every((u) => u.role === "admin")).toBe(true);
    });

    it("should filter with multiple where clauses", async () => {
      const result = await db
        .query("users")
        .where("role", "==", "user")
        .where("age", ">=", 30)
        .collect();

      expect(result).toHaveLength(2);
      expect(result.every((u) => u.role === "user" && u.age! >= 30)).toBe(true);
    });

    it("should order results", async () => {
      const users = await db.query("users").order("name", "asc").collect();

      expect(users[0].name).toBe("Alice");
      expect(users[1].name).toBe("Bob");
      expect(users[2].name).toBe("Charlie");
      expect(users[3].name).toBe("Diana");
    });

    it("should order descending", async () => {
      const users = await db.query("users").order("name", "desc").collect();

      expect(users[0].name).toBe("Diana");
      expect(users[3].name).toBe("Alice");
    });

    it("should limit results", async () => {
      const users = await db.query("users").limit(2).collect();
      expect(users).toHaveLength(2);
    });

    it("should combine where, order, and limit", async () => {
      const users = await db
        .query("users")
        .where("role", "==", "user")
        .order("age", "desc")
        .limit(1)
        .collect();

      expect(users).toHaveLength(1);
      expect(users[0].name).toBe("Charlie");
      expect(users[0].age).toBe(35);
    });

    it("should get first document", async () => {
      const user = await db.query("users").order("name", "asc").first();

      expect(user).toBeDefined();
      expect(user?.name).toBe("Alice");
    });

    it("should return null when no documents match", async () => {
      const user = await db.query("users").where("name", "==", "Nonexistent").first();

      expect(user).toBeNull();
    });
  });

  describe("Relationships", () => {
    it("should handle document references", async () => {
      // Create user
      const userId = await db.insert("users", {
        name: "Author",
        email: "author@example.com",
        role: "user",
      });

      // Create post referencing user
      const postId = await db.insert("posts", {
        userId,
        title: "My First Post",
        content: "This is the content",
        published: true,
        views: 0,
      });

      // Retrieve post
      const post = await db.get(postId);
      expect(post?.userId).toBe(userId);

      // Retrieve referenced user
      const author = await db.get(post!.userId);
      expect(author?.name).toBe("Author");
    });

    it("should query posts by user", async () => {
      const user1Id = await db.insert("users", {
        name: "User 1",
        email: "user1@example.com",
        role: "user",
      });

      const user2Id = await db.insert("users", {
        name: "User 2",
        email: "user2@example.com",
        role: "user",
      });

      await db.insert("posts", {
        userId: user1Id,
        title: "User 1 Post 1",
        content: "Content",
        published: true,
        views: 10,
      });

      await db.insert("posts", {
        userId: user1Id,
        title: "User 1 Post 2",
        content: "Content",
        published: false,
        views: 5,
      });

      await db.insert("posts", {
        userId: user2Id,
        title: "User 2 Post",
        content: "Content",
        published: true,
        views: 20,
      });

      // Query posts by user1
      const user1Posts = await db.query("posts").where("userId", "==", user1Id).collect();

      expect(user1Posts).toHaveLength(2);
      expect(user1Posts.every((p) => p.userId === user1Id)).toBe(true);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent inserts", async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        db.insert("users", {
          name: `User ${i}`,
          email: `user${i}@example.com`,
          role: "user",
        })
      );

      const userIds = await Promise.all(promises);
      expect(userIds).toHaveLength(10);
      expect(new Set(userIds).size).toBe(10); // All unique

      const users = await db.query("users").collect();
      expect(users).toHaveLength(10);
    });

    it("should handle concurrent updates", async () => {
      const userId = await db.insert("users", {
        name: "Test",
        email: "test@example.com",
        role: "user",
      });

      // Perform concurrent patches
      await Promise.all([
        db.patch(userId, { name: "Update 1" }),
        db.patch(userId, { age: 25 }),
        db.patch(userId, { role: "admin" }),
      ]);

      const user = await db.get(userId);
      expect(user).toBeDefined();
      // Note: Last write wins in Firestore
      expect(user?.age).toBe(25);
      expect(user?.role).toBe("admin");
    });
  });

  describe("Large Data Sets", () => {
    it("should handle inserting and querying many documents", async () => {
      // Insert 50 users
      const promises = Array.from({ length: 50 }, (_, i) =>
        db.insert("users", {
          name: `User ${i}`,
          email: `user${i}@example.com`,
          age: 20 + (i % 30),
          role: i % 2 === 0 ? "admin" : "user",
        })
      );

      await Promise.all(promises);

      // Query all
      const allUsers = await db.query("users").collect();
      expect(allUsers).toHaveLength(50);

      // Query with filter
      const admins = await db.query("users").where("role", "==", "admin").collect();
      expect(admins).toHaveLength(25);

      // Query with age filter
      const youngUsers = await db.query("users").where("age", "<", 30).collect();
      expect(youngUsers.length).toBeGreaterThan(0);
    });
  });
});
