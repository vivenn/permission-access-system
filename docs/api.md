# API Guide

This document explains the package API, the configuration shape, and the runtime fields used during permission checks.

## Main Exports

- `AccessControlEngine`
- `createAccessControl`
- `isAllowed`
- `resolveUserPermissions`
- `requirePermission`

## Engine Creation

Factory form:

```ts
import { createAccessControl } from "permission-access-system";

const accessControl = createAccessControl(roleConfig);
```

JSON file form:

```ts
import { createAccessControl } from "permission-access-system";

const accessControl = createAccessControl("./rules.json");
```

The file path is resolved from the current working directory of the app process.

Class form:

```ts
import { AccessControlEngine } from "permission-access-system";

const accessControl = new AccessControlEngine(roleConfig);
```

Both give you the same engine behavior.

`createAccessControl(...)` accepts:

- a role configuration object
- a JSON file path

## JSON File Shape

The expected JSON file format is:

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

## Engine Methods

### `can(check)`

Runs a permission check and returns an `AccessDecision`.

### `getPermissions(roleKeys)`

Returns the final flattened permission list for the given roles.

### `getRoles()`

Returns the stored role configuration.

## Role Definition

Each role has:

- `permissions`
- optional `inherits`

Example:

```ts
{
  manager: {
    permissions: [
      { resource: "lead", action: "read", scope: "team" }
    ]
  },
  admin: {
    inherits: ["manager"],
    permissions: [
      { resource: "user", action: "manage", scope: "any" }
    ]
  }
}
```

## Permission Grant

Each permission can include:

- `resource`
- `action`
- optional `scope`
- optional `effect`
- optional `condition`

Example:

```ts
{
  resource: "invoice",
  action: "refund",
  scope: "any",
  effect: "deny",
  condition: ({ resource }) => resource?.status === "locked"
}
```

## JSON Permission Grant

When rules come from `rules.json`, conditions must be declarative.

Example:

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

Supported JSON condition operators:

- `equals`
- `notEquals`
- `in`
- `notIn`
- `exists`
- `notExists`

## Scopes

Supported scopes:

- `any`
- `own`
- `team`

Meaning:

- `any`: no ownership or team restriction
- `own`: user id must match the resource owner id
- `team`: resource team id must match one of the user team ids

## Access Check Shape

`can(check)` expects:

```ts
{
  user: {
    id: "user_1",
    roleKeys: ["manager"],
    teamIds: ["team_west"]
  },
  resource: "lead",
  action: "update",
  resourceOwnerId: "user_7",
  resourceTeamId: "team_west",
  resourceData: {
    id: "lead_1",
    status: "open"
  }
}
```

## Access Check Fields

### `resource`

The type of thing being protected.

Examples:

- `lead`
- `invoice`
- `user`
- `task`
- `report`

This field is required.

### `action`

The operation being attempted.

Examples:

- `read`
- `create`
- `update`
- `delete`
- `manage`
- `refund`

This field is required.

### `resourceOwnerId`

The user id of the record owner.

Use this when the permission uses `own` scope.

Example:

```ts
resourceOwnerId: "user_1"
```

If the resource does not use owner-based access, this can be omitted.

### `resourceTeamId`

The team id of the record.

Use this when the permission uses `team` scope.

Example:

```ts
resourceTeamId: "team_west"
```

If the resource does not use team-based access, this can be omitted.

### `resourceData`

Extra resource data used for conditional rules.

Example:

```ts
resourceData: {
  id: "inv_1",
  status: "locked"
}
```

Use this when a condition needs record fields beyond owner or team.

## Decision Shape

The returned decision looks like:

```ts
{
  allowed: true,
  reason: "Access allowed.",
  matchedScopes: ["team"]
}
```

Fields:

- `allowed`: final allow/deny result
- `reason`: explanation of the result
- `matchedScopes`: scopes that matched the request

## Validation

The engine validates role configuration when it is created.

It throws when:

- a role inherits from a missing role
- role inheritance is circular

## Middleware Adapter

The package also exports:

- `requirePermission`

This is a helper for Express-style middleware integration.

See:

- `docs/middleware-integration.md`
