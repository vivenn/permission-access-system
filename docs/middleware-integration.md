# Middleware Integration

This guide explains how to use `permission-access-system` inside request middleware so an application can allow or block incoming requests based on roles, scopes, and resource ownership.

## Why Middleware Integration Matters

In most backend applications, authorization happens while handling an incoming request.

Typical example:

1. the user sends a request
2. the app authenticates the user
3. the app loads the target resource
4. the app checks whether the user can perform the requested action
5. the app either allows the request or returns `403 Forbidden`

This package is designed to be the decision layer in that flow.

## Typical Request Flow

The usual middleware order looks like this:

1. authentication middleware
2. resource-loading middleware
3. permission middleware
4. route handler or controller

That order matters because the permission check often needs:

- the current user
- the requested resource type
- the action being attempted
- the target record owner
- the target record team

## Step 1: Create The Access Control Instance

Create the permission engine once and reuse it across the application.

```ts
import { createAccessControl } from "permission-access-system";

export const accessControl = createAccessControl({
  admin: {
    permissions: [
      { resource: "lead", action: "read", scope: "any" },
      { resource: "lead", action: "update", scope: "any" },
      { resource: "lead", action: "delete", scope: "any" },
      { resource: "user", action: "manage", scope: "any" }
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

## Step 2: Attach User Identity

Your authentication middleware should attach user information to the request.

Example:

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

The permission system expects the application to provide:

- user id
- role list
- optional team ids

## Step 3: Load The Target Resource

If access depends on record ownership or team ownership, load the resource before the permission middleware runs.

Example:

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

This is important for:

- own-scope checks
- team-scope checks
- conditional permission rules

## Step 4: Create Permission Middleware

The middleware should call `accessControl.can(...)` and either continue or reject the request.

```ts
import { accessControl } from "./access-control";

export function requirePermission(resource: string, action: string) {
  return (req, res, next) => {
    const decision = accessControl.can({
      user: {
        id: req.auth.userId,
        roleKeys: req.auth.roles,
        teamIds: req.auth.teamIds
      },
      resource,
      action,
      resourceOwnerId: req.record?.ownerId,
      resourceTeamId: req.record?.teamId,
      resourceData: req.record
    });

    if (!decision.allowed) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: decision.reason
        }
      });
    }

    next();
  };
}
```

## Step 5: Use Middleware On Routes

Example with Express:

```ts
import express from "express";
import { attachAuth } from "./auth-middleware";
import { loadLead } from "./load-lead";
import { requirePermission } from "./require-permission";

const app = express();

app.use(attachAuth);

app.get(
  "/leads/:id",
  loadLead,
  requirePermission("lead", "read"),
  (req, res) => {
    res.json(req.record);
  }
);

app.patch(
  "/leads/:id",
  loadLead,
  requirePermission("lead", "update"),
  (req, res) => {
    res.json({ success: true });
  }
);
```

## What The Middleware Is Responsible For

This permission middleware is responsible for:

- translating request context into a permission check
- blocking unauthorized requests
- allowing authorized requests to continue
- returning a consistent `403` response when access is denied

## What It Should Not Be Responsible For

The middleware should not contain all business logic.

Keep it focused on access control.

Business-specific validation can still happen later in services or use cases.

Examples:

- middleware decides whether a user can update a lead
- service logic decides whether that lead can move to a specific status

## When To Use Route Middleware

Route middleware is a good fit for:

- protecting REST endpoints
- protecting admin routes
- protecting CRUD operations
- applying broad permission checks early

## When To Add Service-Level Checks Too

Middleware alone is not always enough.

Use additional checks in the service layer when:

- the rule depends on business state
- the rule depends on more than one resource
- the action is sensitive and should be enforced deeper in the app
- background jobs or internal services can trigger the same logic

## Recommended Pattern

Use both layers:

- middleware for request-level authorization
- service checks for deeper business rules

That keeps the access model safer and easier to maintain.

## Summary

To control requests with this package:

1. authenticate the user
2. attach user roles and team data to the request
3. load the target resource if scope or ownership matters
4. call `accessControl.can(...)` in middleware
5. allow or deny the request based on the decision
