import { createAccessControl } from "../index.js";

const accessControl = createAccessControl({
  billing_admin: {
    permissions: [
      { resource: "invoice", action: "read", scope: "any" },
      { resource: "invoice", action: "refund", scope: "any" },
      {
        resource: "invoice",
        action: "refund",
        scope: "any",
        effect: "deny",
        condition: ({ resource }) => resource?.status === "locked"
      }
    ]
  }
});

const openInvoiceDecision = accessControl.can({
  user: {
    id: "user_finance",
    roleKeys: ["billing_admin"]
  },
  resource: "invoice",
  action: "refund",
  resourceData: {
    id: "inv_100",
    status: "open"
  }
});

const lockedInvoiceDecision = accessControl.can({
  user: {
    id: "user_finance",
    roleKeys: ["billing_admin"]
  },
  resource: "invoice",
  action: "refund",
  resourceData: {
    id: "inv_101",
    status: "locked"
  }
});

console.log("open invoice:", openInvoiceDecision);
console.log("locked invoice:", lockedInvoiceDecision);
