import test from "node:test";
import assert from "node:assert/strict";

import {
  createAccessControl,
  isAllowed,
  requirePermission,
  resolveUserPermissions
} from "../dist/index.js";

test("allows an own-scope action for the record owner", () => {
  const accessControl = createAccessControl({
    author: {
      permissions: [{ resource: "article", action: "update", scope: "own" }]
    }
  });

  const decision = accessControl.can({
    user: {
      id: "user_1",
      roleKeys: ["author"]
    },
    resource: "article",
    action: "update",
    resourceOwnerId: "user_1"
  });

  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.matchedScopes, ["own"]);
});

test("denies team-scope access for a different team", () => {
  const accessControl = createAccessControl({
    manager: {
      permissions: [{ resource: "lead", action: "read", scope: "team" }]
    }
  });

  const decision = accessControl.can({
    user: {
      id: "manager_1",
      roleKeys: ["manager"],
      teamIds: ["team_west"]
    },
    resource: "lead",
    action: "read",
    resourceTeamId: "team_east"
  });

  assert.equal(decision.allowed, false);
  assert.equal(
    decision.reason,
    "Permission exists, but resource scope or condition did not match."
  );
});

test("allows team-scope access for the same team", () => {
  const accessControl = createAccessControl({
    manager: {
      permissions: [{ resource: "lead", action: "read", scope: "team" }]
    }
  });

  const decision = accessControl.can({
    user: {
      id: "manager_1",
      roleKeys: ["manager"],
      teamIds: ["team_west"]
    },
    resource: "lead",
    action: "read",
    resourceTeamId: "team_west"
  });

  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.matchedScopes, ["team"]);
});

test("denies own-scope access for a different owner", () => {
  const accessControl = createAccessControl({
    author: {
      permissions: [{ resource: "article", action: "update", scope: "own" }]
    }
  });

  const decision = accessControl.can({
    user: {
      id: "user_1",
      roleKeys: ["author"]
    },
    resource: "article",
    action: "update",
    resourceOwnerId: "user_2"
  });

  assert.equal(decision.allowed, false);
});

test("denies own-scope access when resourceOwnerId is missing", () => {
  const accessControl = createAccessControl({
    author: {
      permissions: [{ resource: "article", action: "read", scope: "own" }]
    }
  });

  const decision = accessControl.can({
    user: {
      id: "user_1",
      roleKeys: ["author"]
    },
    resource: "article",
    action: "read"
  });

  assert.equal(decision.allowed, false);
});

test("denies team-scope access when resourceTeamId is missing", () => {
  const accessControl = createAccessControl({
    manager: {
      permissions: [{ resource: "lead", action: "read", scope: "team" }]
    }
  });

  const decision = accessControl.can({
    user: {
      id: "manager_1",
      roleKeys: ["manager"],
      teamIds: ["team_west"]
    },
    resource: "lead",
    action: "read"
  });

  assert.equal(decision.allowed, false);
});

test("explicit deny overrides allow when the condition matches", () => {
  const decision = isAllowed(
    [
      { resource: "invoice", action: "refund", scope: "any" },
      {
        resource: "invoice",
        action: "refund",
        scope: "any",
        effect: "deny",
        condition: ({ resource }) => resource?.status === "locked"
      }
    ],
    {
      user: {
        id: "finance_1",
        roleKeys: ["billing_admin"]
      },
      resource: "invoice",
      action: "refund",
      resourceData: {
        id: "inv_1",
        status: "locked"
      }
    }
  );

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "Access denied by an explicit deny rule.");
});

test("allows any-scope access through createAccessControl.can", () => {
  const accessControl = createAccessControl({
    admin: {
      permissions: [{ resource: "report", action: "read", scope: "any" }]
    }
  });

  const decision = accessControl.can({
    user: {
      id: "admin_1",
      roleKeys: ["admin"]
    },
    resource: "report",
    action: "read"
  });

  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.matchedScopes, ["any"]);
});

test("inherits permissions from parent roles", () => {
  const permissions = resolveUserPermissions(
    {
      member: {
        permissions: [{ resource: "task", action: "read", scope: "own" }]
      },
      editor: {
        inherits: ["member"],
        permissions: [{ resource: "task", action: "update", scope: "own" }]
      }
    },
    ["editor"]
  );

  assert.equal(permissions.length, 2);
});

test("resolves permissions from multiple roles", () => {
  const permissions = resolveUserPermissions(
    {
      viewer: {
        permissions: [{ resource: "lead", action: "read", scope: "any" }]
      },
      editor: {
        permissions: [{ resource: "lead", action: "update", scope: "own" }]
      }
    },
    ["viewer", "editor"]
  );

  assert.equal(permissions.length, 2);
});

test("throws when a role inherits from a missing role", () => {
  assert.throws(
    () =>
      createAccessControl({
        editor: {
          inherits: ["missing_role"],
          permissions: []
        }
      }),
    /inherits from missing role/
  );
});

test("throws when role inheritance is circular", () => {
  assert.throws(
    () =>
      createAccessControl({
        admin: {
          inherits: ["manager"],
          permissions: []
        },
        manager: {
          inherits: ["admin"],
          permissions: []
        }
      }),
    /Circular role inheritance detected/
  );
});

test("creates access control from a json file path", () => {
  const accessControl = createAccessControl(
    new URL("./fixtures/rules.json", import.meta.url).pathname
  );

  const decision = accessControl.can({
    user: {
      id: "manager_1",
      roleKeys: ["manager"],
      teamIds: ["team_west"]
    },
    resource: "lead",
    action: "read",
    resourceTeamId: "team_west"
  });

  assert.equal(decision.allowed, true);
});

test("json declarative conditions deny locked invoices", () => {
  const accessControl = createAccessControl(
    new URL("./fixtures/rules.json", import.meta.url).pathname
  );

  const decision = accessControl.can({
    user: {
      id: "finance_1",
      roleKeys: ["billing_admin"]
    },
    resource: "invoice",
    action: "refund",
    resourceData: {
      id: "inv_1",
      status: "locked"
    }
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, "Access denied by an explicit deny rule.");
});

test("throws when json rules file does not exist", () => {
  assert.throws(
    () => createAccessControl("./test/fixtures/does-not-exist.json"),
    /ENOENT/
  );
});

test("throws when json rules file contains invalid json", () => {
  assert.throws(
    () =>
      createAccessControl(
        new URL("./fixtures/malformed-rules.json", import.meta.url).pathname
      ),
    /SyntaxError|Expected ',' or '}'/
  );
});

test("supports object-based deny conditions for not-equals behavior", () => {
  const accessControl = createAccessControl({
    billing_admin: {
      permissions: [
        { resource: "invoice", action: "refund", scope: "any" },
        {
          resource: "invoice",
          action: "refund",
          scope: "any",
          effect: "deny",
          condition: ({ resource }) => resource?.status !== "open"
        }
      ]
    }
  });

  const openDecision = accessControl.can({
    user: {
      id: "finance_1",
      roleKeys: ["billing_admin"]
    },
    resource: "invoice",
    action: "refund",
    resourceData: {
      status: "open"
    }
  });

  const closedDecision = accessControl.can({
    user: {
      id: "finance_1",
      roleKeys: ["billing_admin"]
    },
    resource: "invoice",
    action: "refund",
    resourceData: {
      status: "closed"
    }
  });

  assert.equal(openDecision.allowed, true);
  assert.equal(closedDecision.allowed, false);
});

test("supports object-based deny conditions for list and existence checks", () => {
  const accessControl = createAccessControl({
    finance: {
      permissions: [
        { resource: "invoice", action: "archive", scope: "any" },
        {
          resource: "invoice",
          action: "archive",
          scope: "any",
          effect: "deny",
          condition: ({ resource }) =>
            ["locked", "paid"].includes(resource?.status)
        }
      ]
    },
    reviewer: {
      permissions: [
        { resource: "document", action: "read", scope: "any" },
        {
          resource: "document",
          action: "read",
          scope: "any",
          effect: "deny",
          condition: ({ resource }) => !resource?.reviewedAt
        }
      ]
    }
  });

  const archiveDenied = accessControl.can({
    user: {
      id: "finance_1",
      roleKeys: ["finance"]
    },
    resource: "invoice",
    action: "archive",
    resourceData: {
      status: "locked"
    }
  });

  const archiveAllowed = accessControl.can({
    user: {
      id: "finance_1",
      roleKeys: ["finance"]
    },
    resource: "invoice",
    action: "archive",
    resourceData: {
      status: "draft"
    }
  });

  const readDenied = accessControl.can({
    user: {
      id: "reviewer_1",
      roleKeys: ["reviewer"]
    },
    resource: "document",
    action: "read",
    resourceData: {}
  });

  const readAllowed = accessControl.can({
    user: {
      id: "reviewer_1",
      roleKeys: ["reviewer"]
    },
    resource: "document",
    action: "read",
    resourceData: {
      reviewedAt: "2026-03-24T12:00:00.000Z"
    }
  });

  assert.equal(archiveDenied.allowed, false);
  assert.equal(archiveAllowed.allowed, true);
  assert.equal(readDenied.allowed, false);
  assert.equal(readAllowed.allowed, true);
});

test("middleware returns 401 when auth context is missing", async () => {
  const accessControl = createAccessControl({
    admin: {
      permissions: [{ resource: "user", action: "manage", scope: "any" }]
    }
  });

  const middleware = requirePermission(accessControl, "user", "manage");
  let responsePayload;
  let nextCalled = false;

  await new Promise((resolve, reject) => {
    middleware(
      {},
      {
        status(code) {
          return {
            json(body) {
              responsePayload = { code, body };
              resolve();
            }
          };
        }
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        nextCalled = true;
        resolve();
      }
    );
  });

  assert.equal(nextCalled, false);
  assert.equal(responsePayload.code, 401);
  assert.equal(responsePayload.body.error.code, "UNAUTHORIZED");
});

test("middleware accepts user context from req.user", async () => {
  const accessControl = createAccessControl({
    manager: {
      permissions: [{ resource: "lead", action: "read", scope: "team" }]
    }
  });

  const middleware = requirePermission(accessControl, "lead", "read");
  let nextCalled = false;

  await new Promise((resolve, reject) => {
    middleware(
      {
        user: {
          id: "manager_1",
          roles: ["manager"],
          teams: ["team_west"]
        },
        record: {
          ownerId: "rep_1",
          teamId: "team_west"
        }
      },
      {
        status() {
          return {
            json(body) {
              reject(new Error(`Unexpected response: ${JSON.stringify(body)}`));
            }
          }
        }
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        nextCalled = true;
        resolve();
      }
    );
  });

  assert.equal(nextCalled, true);
});

test("middleware returns 403 when permission check fails", async () => {
  const accessControl = createAccessControl({
    sales_rep: {
      permissions: [{ resource: "lead", action: "read", scope: "own" }]
    }
  });

  const middleware = requirePermission(accessControl, "lead", "read");
  let responsePayload;
  let nextCalled = false;

  await new Promise((resolve, reject) => {
    middleware(
      {
        auth: {
          userId: "user_1",
          roles: ["sales_rep"]
        },
        record: {
          ownerId: "user_2"
        }
      },
      {
        status(code) {
          return {
            json(body) {
              responsePayload = { code, body };
              resolve();
            }
          };
        }
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        nextCalled = true;
        resolve();
      }
    );
  });

  assert.equal(nextCalled, false);
  assert.equal(responsePayload.code, 403);
  assert.equal(responsePayload.body.error.code, "FORBIDDEN");
});

test("middleware calls next when permission check passes", async () => {
  const accessControl = createAccessControl({
    manager: {
      permissions: [{ resource: "lead", action: "read", scope: "team" }]
    }
  });

  const middleware = requirePermission(accessControl, "lead", "read");
  let nextCalled = false;

  await new Promise((resolve, reject) => {
    middleware(
      {
        auth: {
          userId: "manager_1",
          roles: ["manager"],
          teamIds: ["team_west"]
        },
        record: {
          ownerId: "rep_1",
          teamId: "team_west"
        }
      },
      {
        status() {
          return {
            json(body) {
              reject(new Error(`Unexpected response: ${JSON.stringify(body)}`));
            }
          }
        }
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        nextCalled = true;
        resolve();
      }
    );
  });

  assert.equal(nextCalled, true);
});

test("middleware can load a record before permission check", async () => {
  const accessControl = createAccessControl({
    manager: {
      permissions: [{ resource: "lead", action: "read", scope: "team" }]
    }
  });

  const req = {
    params: {
      id: "lead_1"
    },
    auth: {
      userId: "manager_1",
      roles: ["manager"],
      teamIds: ["team_west"]
    }
  };

  const middleware = requirePermission(accessControl, "lead", "read", {
    async loadRecord(request) {
      return {
        id: request.params.id,
        ownerId: "rep_1",
        teamId: "team_west"
      };
    }
  });

  let nextCalled = false;

  await new Promise((resolve, reject) => {
    middleware(
      req,
      {
        status() {
          return {
            json(body) {
              reject(new Error(`Unexpected response: ${JSON.stringify(body)}`));
            }
          };
        }
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        nextCalled = true;
        resolve();
      }
    );
  });

  assert.equal(nextCalled, true);
  assert.equal(req.record.id, "lead_1");
  assert.equal(req.record.teamId, "team_west");
});

test("middleware accepts a shorthand loadRecord callback", async () => {
  const accessControl = createAccessControl({
    manager: {
      permissions: [{ resource: "lead", action: "read", scope: "team" }]
    }
  });

  const req = {
    params: {
      id: "lead_1"
    },
    auth: {
      userId: "manager_1",
      roles: ["manager"],
      teamIds: ["team_west"]
    }
  };

  const middleware = requirePermission(
    accessControl,
    "lead",
    "read",
    async (request) => ({
      id: request.params.id,
      ownerId: "rep_1",
      teamId: "team_west"
    })
  );

  await new Promise((resolve, reject) => {
    middleware(
      req,
      {
        status() {
          return {
            json(body) {
              reject(new Error(`Unexpected response: ${JSON.stringify(body)}`));
            }
          };
        }
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      }
    );
  });

  assert.equal(req.record.id, "lead_1");
});

test("middleware accepts a custom getUser mapper", async () => {
  const accessControl = createAccessControl({
    manager: {
      permissions: [{ resource: "lead", action: "read", scope: "team" }]
    }
  });

  const middleware = requirePermission(accessControl, "lead", "read", {
    getUser(req) {
      return {
        id: req.currentUser.uuid,
        roleKeys: req.currentUser.permissions,
        teamIds: req.currentUser.groupIds
      };
    },
    loadRecord() {
      return {
        ownerId: "rep_1",
        teamId: "team_west"
      };
    }
  });

  let nextCalled = false;

  await new Promise((resolve, reject) => {
    middleware(
      {
        currentUser: {
          uuid: "manager_1",
          permissions: ["manager"],
          groupIds: ["team_west"]
        }
      },
      {
        status() {
          return {
            json(body) {
              reject(new Error(`Unexpected response: ${JSON.stringify(body)}`));
            }
          };
        }
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        nextCalled = true;
        resolve();
      }
    );
  });

  assert.equal(nextCalled, true);
});

test("middleware accepts a custom record mapper", async () => {
  const accessControl = createAccessControl({
    sales_rep: {
      permissions: [{ resource: "lead", action: "read", scope: "own" }]
    }
  });

  const middleware = requirePermission(accessControl, "lead", "read", {
    getRecordContext(req) {
      return {
        resourceOwnerId: req.record?.createdBy,
        resourceTeamId: req.record?.groupId,
        resourceData: req.record
      };
    }
  });

  let nextCalled = false;

  await new Promise((resolve, reject) => {
    middleware(
      {
        auth: {
          userId: "user_1",
          roles: ["sales_rep"]
        },
        record: {
          id: "lead_1",
          createdBy: "user_1",
          groupId: "team_west"
        }
      },
      {
        status() {
          return {
            json(body) {
              reject(new Error(`Unexpected response: ${JSON.stringify(body)}`));
            }
          };
        }
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        nextCalled = true;
        resolve();
      }
    );
  });

  assert.equal(nextCalled, true);
});

test("middleware passes loadRecord errors to next", async () => {
  const accessControl = createAccessControl({
    manager: {
      permissions: [{ resource: "lead", action: "read", scope: "team" }]
    }
  });

  const expectedError = new Error("database unavailable");
  const middleware = requirePermission(accessControl, "lead", "read", {
    async loadRecord() {
      throw expectedError;
    }
  });

  await new Promise((resolve, reject) => {
    middleware(
      {
        auth: {
          userId: "manager_1",
          roles: ["manager"],
          teamIds: ["team_west"]
        }
      },
      {
        status() {
          return {
            json(body) {
              reject(new Error(`Unexpected response: ${JSON.stringify(body)}`));
            }
          };
        }
      },
      (error) => {
        try {
          assert.equal(error, expectedError);
          resolve();
        } catch (assertionError) {
          reject(assertionError);
        }
      }
    );
  });
});
