# Permission Access System

`permission-access-system` is a reusable authorization project for applications that need controlled access to resources, actions, features, and records.

It is intended for apps where access depends on role, team, or ownership. Instead of spreading permission checks across routes, services, and controllers, this project gives you one structured place to manage them.

## What This Project Does

This project helps applications answer questions like:

- can this user access this resource
- can this user create, read, update, or delete this record
- should this user have global access, team-level access, or owner-only access
- how can access rules stay consistent across the whole application

It is a good fit for:

- SaaS products
- CRM and ERP systems
- internal company tools
- admin dashboards
- business apps with multiple user roles
- team-based workflow platforms

## Why This Project Exists

Authorization logic often becomes difficult to manage as an application grows. In many codebases, permission rules end up repeated in multiple places, which leads to inconsistency and makes access behavior harder to trust.

This project exists to solve that by providing a reusable permission layer that can be adopted across different applications and extended as requirements grow.

## What Problem It Solves

This project helps solve common access-control problems:

- role-based access control
- team-based access
- owner-based access
- centralized permission decisions
- reusable authorization logic across modules
- safer and more consistent API protection

Typical examples:

- an admin can manage all users and records
- a manager can access records owned by their team
- a sales representative can update only their own leads
- a support user can view tickets but cannot delete them
- a finance role can access invoices but not user administration

## How Others Can Use It

There are two practical ways to use this project.

### Clone The Repository

Best when you want to customize the project deeply for your own product.

```bash
git clone https://github.com/viven1426/permission-access-system.git
```

Use this when you want:

- full source control
- internal customization
- a private fork
- a starting point for your own permission system

### Install Directly From GitHub

Best when you want to reuse the project as a dependency without manually copying the source.

```bash
npm install github:viven1426/permission-access-system
```

Use this when you want:

- GitHub-based dependency reuse
- easier integration into another Node.js app
- updates tied to the repository

## Public API

The package currently exposes:

- `createAccessControl`
- `isAllowed`
- `resolveUserPermissions`

Basic usage:

```ts
import { createAccessControl } from "permission-access-system";

const accessControl = createAccessControl({
  admin: {
    permissions: [{ resource: "project", action: "read", scope: "any" }]
  }
});

const decision = accessControl.can({
  user: {
    id: "user_1",
    roleKeys: ["admin"]
  },
  resource: "project",
  action: "read"
});
```

Decision shape:

```ts
{
  allowed: true,
  reason: "Access allowed.",
  matchedScopes: ["any"]
}
```

## Compatibility

The current package interface is ESM-based.

Use:

```ts
import { createAccessControl } from "permission-access-system";
```

If your application is CommonJS-only, the safer option for now is to clone the repository and adapt it locally.

## How It Typically Fits Into An App

In a real application, this project usually acts as the authorization layer.

Typical flow:

1. the application authenticates the user
2. the application identifies the user role or roles
3. the application sends the user context and requested action into the permission system
4. the permission system decides whether access is allowed
5. the application applies that result in routes, services, APIs, or UI logic

## Documentation

Project documentation is available in:

- `docs/getting-started.md`
- `docs/use-cases.md`
- `docs/examples.md`
- `docs/api.md`

## Included Examples

The repository includes step-by-step examples for common authorization patterns:

- `01-basic-rbac.ts`
- `02-own-scope.ts`
- `03-team-scope.ts`
- `04-role-inheritance.ts`
- `05-explicit-deny.ts`
- `crm-example.ts`

## Who This Project Is For

This project is useful for:

- backend developers
- full-stack developers
- startup teams building role-based products
- teams building internal business tools
- developers creating multi-user applications
- anyone who wants a reusable permission system from GitHub

## Future Scope

This project can be extended further with:

- audit logging
- database-backed permissions
- role management UI
- field-level access control
- multi-tenant support
- frontend permission helpers
- framework-specific adapters
- middleware packages
- sample app integrations
- admin dashboards for permission management

## Goal

The goal of this project is to stay practical, reusable, and easy to adapt so developers can start faster, keep permission logic organized, and reuse the same authorization foundation across projects.
