import { createFunctionRunner } from "@smartbill/firestore-convex-style/server";
import { getFirestore } from "firebase-admin/firestore";
import { api, internal } from "../firestore/_generated/api.js";
import { schema } from "../firestore/schema.js";
import { createCustomer, getCustomerById } from "../firestore/functions.js";
import type { Id } from "../firestore/_generated/dataModel.js";

import { initializeApp } from "firebase-admin/app";

initializeApp({
  projectId: "demo-test-project",
});

async function main() {
  const firestore = getFirestore();
  const runner = createFunctionRunner(firestore, schema);

  const customerId = await runner.runMutation(createCustomer, {
    userId: "users:abc123" as Id<"users">,
    name: "Acme Corp",
    email: "contact@acme.com",
  });

  const user = await runner.runQuery(getCustomerById, { customerId: customerId });
  console.log(user);
}

main()
  .catch(console.error)
  .finally(() => {
    process.exit(0);
  });
