# Getting Started

This guide explains how to use `permission-access-system` in your own application.

## When To Use This Project

Use this project when your app needs to control:

- who can access a resource
- what action a user can perform
- whether access should apply to all records, team records, or only owned records

Typical examples:

- admin and manager roles
- team-based access
- owner-based record access
- protected backend APIs

## Use The Project In Your App

You can use the project in two main ways.

### Clone And Customize

```bash
git clone https://github.com/viven1426/permission-access-system.git
```

This approach is useful when you want to change the project structure or permission model directly.

### Install From GitHub

```bash
npm install github:viven1426/permission-access-system
```

This approach is useful when you want to consume it inside another Node.js application.

## Import Style

This project currently uses an ESM package interface.

Use imports like:

```ts
import { createAccessControl } from "permission-access-system";
```

If your application is still CommonJS-only, clone the repository and adapt it locally instead of installing it as a package dependency.

## Basic Example

```ts
import { createAccessControl } from "permission-access-system";

const accessControl = createAccessControl({
  admin: {
    permissions: [
      { resource: "project", action: "read", scope: "any" },
      { resource: "project", action: "create", scope: "any" },
      { resource: "project", action: "update", scope: "any" },
      { resource: "project", action: "delete", scope: "any" }
    ]
  },
  viewer: {
    permissions: [{ resource: "project", action: "read", scope: "any" }]
  }
});

const decision = accessControl.can({
  user: {
    id: "user_1",
    roleKeys: ["viewer"]
  },
  resource: "project",
  action: "read"
});

console.log(decision.allowed);
```

## Example: Owner-Based Access

```ts
import { createAccessControl } from "permission-access-system";

const accessControl = createAccessControl({
  author: {
    permissions: [
      { resource: "article", action: "read", scope: "own" },
      { resource: "article", action: "update", scope: "own" }
    ]
  }
});

const decision = accessControl.can({
  user: {
    id: "user_25",
    roleKeys: ["author"]
  },
  resource: "article",
  action: "update",
  resourceOwnerId: "user_25"
});

console.log(decision.allowed);
```

## Example: Team-Based Access

```ts
import { createAccessControl } from "permission-access-system";

const accessControl = createAccessControl({
  manager: {
    permissions: [
      { resource: "lead", action: "read", scope: "team" },
      { resource: "lead", action: "update", scope: "team" }
    ]
  }
});

const decision = accessControl.can({
  user: {
    id: "manager_1",
    roleKeys: ["manager"],
    teamIds: ["team_west"]
  },
  resource: "lead",
  action: "update",
  resourceTeamId: "team_west"
});

console.log(decision.allowed);
```

## Example: Role Inheritance

```ts
import { createAccessControl } from "permission-access-system";

const accessControl = createAccessControl({
  member: {
    permissions: [{ resource: "task", action: "read", scope: "own" }]
  },
  editor: {
    inherits: ["member"],
    permissions: [{ resource: "task", action: "update", scope: "own" }]
  }
});

const decision = accessControl.can({
  user: {
    id: "user_10",
    roleKeys: ["editor"]
  },
  resource: "task",
  action: "read",
  resourceOwnerId: "user_10"
});

console.log(decision.allowed);
```

## Example: Express Middleware Style

```ts
import { createAccessControl } from "permission-access-system";

const accessControl = createAccessControl({
  admin: {
    permissions: [{ resource: "user", action: "manage", scope: "any" }]
  }
});

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

## Suggested Adoption Flow

If you are adding this project to an application, use this order:

1. define your application roles
2. define your protected resources and actions
3. decide whether access is global, team-based, or owner-based
4. connect user identity from authentication
5. use permission checks in APIs and service logic

## Related Example Files

The repository also includes runnable example source files in:

- `src/examples/01-basic-rbac.ts`
- `src/examples/02-own-scope.ts`
- `src/examples/03-team-scope.ts`
- `src/examples/04-role-inheritance.ts`
- `src/examples/05-explicit-deny.ts`
- `src/examples/crm-example.ts`

For a breakdown of what each example demonstrates, see `docs/examples.md`.

For the public API details and decision structure, see `docs/api.md`.

For request-level integration patterns, see `docs/middleware-integration.md`.
