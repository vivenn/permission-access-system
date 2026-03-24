# Getting Started

This guide shows the fastest way to set up and use `permission-access-system` in an application.

## 1. Install

Clone the repository:

```bash
git clone https://github.com/viven1426/permission-access-system.git
```

Or install from GitHub:

```bash
npm install github:viven1426/permission-access-system
```

## 2. Import The Package

This package is ESM-based.

```ts
import { createAccessControl } from "permission-access-system";
```

You can also use the class directly:

```ts
import { AccessControlEngine } from "permission-access-system";
```

## 3. Define Roles And Permissions

Start by defining the roles in your app.

```ts
const roleConfig = {
  admin: {
    permissions: [
      { resource: "lead", action: "read", scope: "any" },
      { resource: "lead", action: "update", scope: "any" },
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
};
```

## 4. Create The Access Control Engine

Recommended:

```ts
const accessControl = createAccessControl(roleConfig);
```

You can also load the same engine from a JSON file:

```ts
const accessControl = createAccessControl("./rules.json");
```

The file path is resolved from the current working directory of the app process.

Equivalent class-based form:

```ts
const accessControl = new AccessControlEngine(roleConfig);
```

Example `rules.json`:

```json
{
  "roles": {
    "manager": {
      "permissions": [
        { "resource": "lead", "action": "read", "scope": "team" }
      ]
    }
  }
}
```

## 5. Run A Permission Check

```ts
const decision = accessControl.can({
  user: {
    id: "user_1",
    roleKeys: ["sales_rep"]
  },
  resource: "lead",
  action: "update",
  resourceOwnerId: "user_1"
});
```

Decision result:

```ts
{
  allowed: true,
  reason: "Access allowed.",
  matchedScopes: ["own"]
}
```

## 6. Choose The Right Scope

Use `any` when the resource is globally accessible for that role.

```ts
{ resource: "report", action: "read", scope: "any" }
```

Use `own` when the resource belongs to one user.

```ts
{ resource: "lead", action: "update", scope: "own" }
```

Use `team` when the resource belongs to a team.

```ts
{ resource: "lead", action: "read", scope: "team" }
```

## 7. Use It In Middleware

If your app is request-based, integrate it in middleware after authentication and after loading the target record.

Built-in adapter:

```ts
import {
  createAccessControl,
  requirePermission
} from "permission-access-system";

const accessControl = createAccessControl(roleConfig);

app.get(
  "/leads/:id",
  loadLead,
  requirePermission(accessControl, "lead", "read"),
  handler
);
```

For the full middleware flow, see `docs/middleware-integration.md`.

## Configuration Checklist

Before using this package in an app, decide:

1. what resources exist in the app
2. what actions are allowed on each resource
3. which roles exist
4. whether each resource uses `any`, `own`, or `team` scope
5. whether any actions need conditional deny rules
6. whether rules will live in code or in `rules.json`

## Common Patterns

Owner-based access:

```ts
accessControl.can({
  user: { id: "user_1", roleKeys: ["author"] },
  resource: "article",
  action: "update",
  resourceOwnerId: "user_1"
});
```

Team-based access:

```ts
accessControl.can({
  user: {
    id: "manager_1",
    roleKeys: ["manager"],
    teamIds: ["team_west"]
  },
  resource: "lead",
  action: "read",
  resourceTeamId: "team_west"
});
```

Conditional deny:

```ts
{
  resource: "invoice",
  action: "refund",
  scope: "any",
  effect: "deny",
  condition: ({ resource }) => resource?.status === "locked"
}
```

JSON-based conditional deny:

```json
{
  "resource": "invoice",
  "action": "refund",
  "scope": "any",
  "effect": "deny",
  "condition": {
    "source": "resource",
    "field": "status",
    "operator": "equals",
    "value": "locked"
  }
}
```

## Next Docs

- `docs/api.md`
- `docs/middleware-integration.md`
- `docs/examples.md`
