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

The built-in adapter expects:

- `req.auth.userId`
- `req.auth.roles`
- optional `req.auth.teamIds`
- optional `req.record.ownerId`
- optional `req.record.teamId`

If your app uses a different request shape, write a custom middleware wrapper.

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
  loadLead,
  requirePermission(accessControl, "lead", "read"),
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

Example:

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
