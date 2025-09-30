/**
 * Example usage of the Firestore Convex-style SDK
 *
 * This shows how to initialize and use the SDK in your application
 */

import admin from "firebase-admin";
import { FunctionRunner } from "../src";
import { schema } from "./schema";
import {
  getCustomerById,
  getCustomersByUser,
  createCustomer,
  updateCustomer,
  createInvoice,
  getInvoicesByStatus,
  updateInvoiceStatus,
} from "./functions";

// Initialize Firebase Admin
admin.initializeApp({
  // Add your Firebase config here
  // credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();

// Create the function runner with your schema
const runner = new FunctionRunner(firestore, schema);

async function exampleUsage() {
  try {
    // Example: Create a customer
    console.log("Creating customer...");
    const customerId = await runner.runMutation(createCustomer, {
      userId: "users:user123" as any, // In real usage, this would come from authentication
      name: "Acme Corporation",
      email: "contact@acme.com",
      phone: "+1-555-0123",
      address: "123 Main St, San Francisco, CA",
      contactName: "John Doe",
    });
    console.log("Customer created:", customerId);

    // Example: Get the customer by ID
    console.log("\nFetching customer...");
    const customer = await runner.runQuery(getCustomerById, {
      customerId,
    });
    console.log("Customer:", customer);

    // Example: Update customer
    console.log("\nUpdating customer...");
    await runner.runMutation(updateCustomer, {
      customerId,
      phone: "+1-555-9999",
      email: "newemail@acme.com",
    });
    console.log("Customer updated");

    // Example: Create an invoice
    console.log("\nCreating invoice...");
    const invoiceId = await runner.runMutation(createInvoice, {
      customerId,
      number: "INV-001",
      amount: 1500.0,
      status: "draft",
      issueDate: Date.now(),
      dueDate: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days from now
      items: [
        {
          description: "Consulting services",
          quantity: 10,
          price: 150.0,
        },
      ],
    });
    console.log("Invoice created:", invoiceId);

    // Example: Update invoice status
    console.log("\nUpdating invoice status...");
    await runner.runMutation(updateInvoiceStatus, {
      invoiceId,
      status: "sent",
    });
    console.log("Invoice status updated");

    // Example: Query invoices by status
    console.log("\nQuerying sent invoices...");
    const sentInvoices = await runner.runQuery(getInvoicesByStatus, {
      userId: "users:user123" as any,
      status: "sent",
    });
    console.log("Sent invoices:", sentInvoices);

    // Example: Query all customers for a user
    console.log("\nQuerying customers...");
    const customers = await runner.runQuery(getCustomersByUser, {
      userId: "users:user123" as any,
    });
    console.log("All customers:", customers);

    // Example: Search customers by name
    console.log("\nSearching customers...");
    const searchResults = await runner.runQuery(getCustomersByUser, {
      userId: "users:user123" as any,
      searchName: "Acme",
    });
    console.log("Search results:", searchResults);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Run the example
if (require.main === module) {
  exampleUsage()
    .then(() => {
      console.log("\nExample completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Example failed:", error);
      process.exit(1);
    });
}

export { runner, exampleUsage };

