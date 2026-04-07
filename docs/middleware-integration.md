# Middleware Integration

This guide shows how to use `permission-access-system` in request middleware.

## Request Flow

Recommended order:

1. authenticate the user
2. attach user identity to the request
3. load the target record if needed
4. run permission middleware
5. continue to the handler or return `403`

## Required Request Context

By default, the built-in adapter accepts either:

- `req.auth.userId`
- `req.auth.roles`
- optional `req.auth.teamIds`
- or `req.user.id`
- or `req.user.userId`
- `req.user.roles` or `req.user.roleKeys`
- optional `req.user.teamIds` or `req.user.teams`
- optional `req.record.ownerId`
- optional `req.record.teamId`

If you do not want a separate preload middleware, you can pass a `loadRecord` function directly to `requirePermission(...)`.
If your request uses a custom user shape, pass `getUser(...)` and map it yourself.
If your record uses different field names than `ownerId` and `teamId`, pass `getRecordContext(...)`.

## Step 1: Create The Engine

```ts
import { createAccessControl } from "permission-access-system";

export const accessControl = createAccessControl({
  admin: {
    permissions: [
      { resource: "lead", action: "read", scope: "any" },
      { resource: "lead", action: "update", scope: "any" }
    ]
  },
  manager: {
    permissions: [
      { resource: "lead", action: "read", scope: "team" },
      { resource: "lead", action: "update", scope: "team" }
    ]
  },
  sales_rep: {
    permissions: [
      { resource: "lead", action: "read", scope: "own" },
      { resource: "lead", action: "update", scope: "own" }
    ]
  }
});
```

You can also load the same engine from a JSON file:

```ts
import { createAccessControl } from "permission-access-system";

export const accessControl = createAccessControl("./rules.json");
```

## Step 2: Attach Auth Context

```ts
export function attachAuth(req, res, next) {
  req.auth = {
    userId: "user_1",
    roles: ["manager"],
    teamIds: ["team_west"]
  };

  next();
}
```

## Step 3: Load The Record

Only do this if your permission depends on owner, team, or record state.

```ts
export function loadLead(req, res, next) {
  req.record = {
    id: req.params.id,
    ownerId: "user_9",
    teamId: "team_west",
    status: "open"
  };

  next();
}
```

If you want to keep route setup shorter, move that logic into `requirePermission(...)`:

```ts
import { requirePermission } from "permission-access-system";

app.get(
  "/leads/:id",
  requirePermission(accessControl, "lead", "read", {
    async loadRecord(req) {
      const lead = await leadRepository.findById(req.params?.id ?? "");

      return {
        ...lead,
        ownerId: lead.ownerId,
        teamId: lead.teamId
      };
    }
  }),
  handler
);
```

`loadRecord` can be sync or async. It can either return the record object or assign `req.record` itself.
You can pass it either as `{ loadRecord }` or directly as the fourth argument.

Shorter form:

```ts
app.get(
  "/leads/:id",
  requirePermission(accessControl, "lead", "read", async (req) => {
    const lead = await leadRepository.findById(req.params?.id ?? "");

    return {
      ...lead,
      ownerId: lead.ownerId,
      teamId: lead.teamId
    };
  }),
  handler
);
```

## Step 4: Use The Built-In Adapter

```ts
import { requirePermission } from "permission-access-system";

app.get(
  "/leads/:id",
  loadLead,
  requirePermission(accessControl, "lead", "read"),
  handler
);
```

The adapter:

- builds an `AccessCheck`
- runs `accessControl.can(...)`
- optionally loads the record first through `loadRecord`
- resolves user context from `req.auth`, `req.user`, or `getUser(...)`
- resolves record ownership/team fields from `req.record` or `getRecordContext(...)`
- returns `403` if denied
- calls `next()` if allowed

## Full Example

```ts
import express from "express";
import {
  createAccessControl,
  requirePermission
} from "permission-access-system";

const app = express();

const accessControl = createAccessControl({
  manager: {
    permissions: [
      { resource: "lead", action: "read", scope: "team" }
    ]
  }
});

function attachAuth(req, res, next) {
  req.auth = {
    userId: "manager_1",
    roles: ["manager"],
    teamIds: ["team_west"]
  };

  next();
}

function loadLead(req, res, next) {
  req.record = {
    id: req.params.id,
    ownerId: "rep_2",
    teamId: "team_west"
  };

  next();
}

app.use(attachAuth);

app.get(
  "/leads/:id",
  requirePermission(accessControl, "lead", "read", {
    async loadRecord(req) {
      return {
        id: req.params?.id,
        ownerId: "rep_2",
        teamId: "team_west"
      };
    }
  }),
  (req, res) => {
    res.json(req.record);
  }
);
```

## When To Write Custom Middleware

Write your own wrapper when:

- request fields use different names
- you want a custom error response
- you need extra check data in `resourceData`
- you want to build the full `AccessCheck` manually

Custom user mapping example:

```ts
app.get(
  "/leads/:id",
  requirePermission(accessControl, "lead", "read", {
    getUser(req) {
      return {
        id: req.session.user.uuid,
        roleKeys: req.session.user.roles,
        teamIds: req.session.user.teamIds
      };
    },
    async loadRecord(req) {
      const lead = await leadRepository.findById(req.params?.id ?? "");

      return {
        ...lead,
        ownerId: lead.ownerId,
        teamId: lead.teamId
      };
    }
  }),
  handler
);
```

Custom record mapping example:

```ts
app.get(
  "/leads/:id",
  requirePermission(accessControl, "lead", "read", {
    async loadRecord(req) {
      return leadRepository.findById(req.params?.id ?? "");
    },
    getRecordContext(req) {
      return {
        resourceOwnerId: req.record?.createdBy,
        resourceTeamId: req.record?.groupId,
        resourceData: req.record
      };
    }
  }),
  handler
);
```

Full custom middleware example:

```ts
export function requireLeadUpdate(accessControl) {
  return (req, res, next) => {
    const decision = accessControl.can({
      user: {
        id: req.user.id,
        roleKeys: req.user.roles,
        teamIds: req.user.teams
      },
      resource: "lead",
      action: "update",
      resourceOwnerId: req.lead.ownerUserId,
      resourceTeamId: req.lead.salesTeamId,
      resourceData: req.lead
    });

    if (!decision.allowed) {
      return res.status(403).json({ message: decision.reason });
    }

    next();
  };
}
```

## Middleware Responsibility

Middleware should do request-level access control.

Service logic can still do deeper business checks when needed.

Good split:

- middleware decides whether the request may proceed
- services decide whether the business action is valid
