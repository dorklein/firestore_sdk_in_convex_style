import * as admin from "firebase-admin";
import { Firestore } from "firebase-admin/firestore";

let firestoreInstance: Firestore | null = null;

/**
 * Initialize Firebase Admin SDK to connect to the emulator
 */
export function initializeFirebaseEmulator(): Firestore {
  if (firestoreInstance) {
    return firestoreInstance;
  }

  // Initialize Firebase Admin with emulator settings
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: "demo-test-project",
    });
  }

  firestoreInstance = admin.firestore();

  // Connect to emulator
  firestoreInstance.settings({
    host: "localhost:8080",
    ssl: false,
  });

  return firestoreInstance;
}

/**
 * Clear all data from Firestore emulator
 */
export async function clearFirestoreData(firestore: Firestore): Promise<void> {
  // Get all collections
  const collections = await firestore.listCollections();

  // Delete all documents in each collection
  const deletePromises = collections.map(async (collection) => {
    const snapshot = await collection.get();
    const batch = firestore.batch();

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  });

  await Promise.all(deletePromises);
}

/**
 * Clean up Firebase Admin
 */
export async function cleanupFirebase(): Promise<void> {
  if (firestoreInstance) {
    await firestoreInstance.terminate();
    firestoreInstance = null;
  }

  // Delete all apps
  await Promise.all(admin.apps.map((app) => app?.delete()));
}

/**
 * Helper to check if emulator is running
 */
export async function isEmulatorRunning(): Promise<boolean> {
  try {
    const response = await fetch("http://localhost:8080");
    return response.ok || response.status === 404; // 404 is fine, means emulator is up
  } catch (error) {
    return false;
  }
}
