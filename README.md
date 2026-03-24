# Permission Access System

`permission-access-system` is a reusable authorization package for applications that need controlled access to resources, actions, and records.

It is designed for apps where access depends on:

- role
- team
- ownership

This package helps you keep permission logic in one place instead of spreading checks across routes, controllers, and services.

## What It Solves

Use this package when your app needs rules like:

- admin can manage all users
- manager can access team records
- user can access only their own records
- some actions must be denied when a record is in a restricted state

## Main Exports

- `AccessControlEngine`
- `createAccessControl`
- `isAllowed`
- `resolveUserPermissions`
- `requirePermission`

## Quick Example

```ts
import { createAccessControl } from "permission-access-system";

const accessControl = createAccessControl({
  admin: {
    permissions: [{ resource: "lead", action: "read", scope: "any" }]
  },
  sales_rep: {
    permissions: [{ resource: "lead", action: "read", scope: "own" }]
  }
});

const decision = accessControl.can({
  user: {
    id: "user_1",
    roleKeys: ["sales_rep"]
  },
  resource: "lead",
  action: "read",
  resourceOwnerId: "user_1"
});
```

## Installation

Clone the repository:

```bash
git clone https://github.com/viven1426/permission-access-system.git
```

Or install directly from GitHub:

```bash
npm install github:viven1426/permission-access-system
```

## Compatibility

- ESM package
- Node.js `>=20`

If your app is CommonJS-only, clone the repository and adapt it locally.

## Documentation

Use these docs in this order:

- `docs/getting-started.md` for setup and implementation
- `docs/api.md` for config shape and runtime fields
- `docs/middleware-integration.md` for request middleware integration
- `docs/examples.md` for guided examples
- `docs/use-cases.md` for where this package fits

## Current Structure

```text
src/
  core/
  types/
  adapters/
  examples/
```

The package uses:

- class-based public engine
- functional internal evaluation logic

## Goal

The goal of this package is to stay simple to understand, easy to integrate, and practical for real applications.
