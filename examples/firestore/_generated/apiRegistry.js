/* eslint-disable */
/**
 * Generated `apiRegistry` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx @smartbill/firestore-convex-style dev`.
 * @module
 */

import * as demoWithActions from "../demoWithActions.js";
import * as functions from "../functions.js";

export const apiRegistry = {
  "demoWithActions:getUserById": demoWithActions.getUserById,
  "demoWithActions:createNotificationLog":
    demoWithActions.createNotificationLog,
  "demoWithActions:processUserAction": demoWithActions.processUserAction,
  "demoWithActions:tryProcessUserAction": demoWithActions.tryProcessUserAction,
  "functions:getCustomerById": functions.getCustomerById,
  "functions:getCustomersByUser": functions.getCustomersByUser,
  "functions:getInvoicesByStatus": functions.getInvoicesByStatus,
  "functions:createCustomer": functions.createCustomer,
  "functions:updateCustomer": functions.updateCustomer,
  "functions:createInvoice": functions.createInvoice,
  "functions:updateInvoiceStatus": functions.updateInvoiceStatus,
  "functions:deleteCustomer": functions.deleteCustomer,
};
