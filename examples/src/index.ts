import { createFunctionRunner } from "@smartbill/firestore-convex-style/server";
import { getFirestore } from "firebase-admin/firestore";
import { api, internal } from "../firestore/_generated/api.js";
import { schema } from "../firestore/schema.js";
import { createCustomer, getCustomerById } from "../firestore/functions.js";
import type { Id } from "../firestore/_generated/dataModel.js";

import { initializeApp } from "firebase-admin/app";
import { credential } from "firebase-admin";
import { processUserAction } from "../firestore/demoWithActions.js";

initializeApp({
  projectId: "demo-test-project",
  credential: credential.applicationDefault(),
});

async function main() {
  const runner = createFunctionRunner(schema);

  //   const customerId = await runner.runMutation(createCustomer, {
  //     userId: "users:abc123" as Id<"users">,
  //     name: "Acme Corp",
  //     email: "contact@acme.com",
  //   });

  //   const user = await runner.runQuery(getCustomerById, { customerId: customerId });
  //   console.log(user);

  console.log({ api, internal });

  const res = await runner.runAction(processUserAction, {
    userId: "users:abc123" as Id<"users">,
    customerId: "customers:abc123" as Id<"customers">,
    operation: "create",
  });
  console.log(res);
}

main()
  .catch(console.error)
  .finally(() => {
    process.exit(0);
  });
