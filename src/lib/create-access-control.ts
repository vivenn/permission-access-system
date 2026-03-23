import type {
  AccessCheck,
  AccessControl,
  AccessDecision,
  PermissionGrant,
  ResourceScope,
  RoleDefinition
} from "./types.js";

function assertRoleExists(
  roles: Record<string, RoleDefinition>,
  roleKey: string
): RoleDefinition {
  const role = roles[roleKey];

  if (!role) {
    throw new Error(`Unknown role definition "${roleKey}".`);
  }

  return role;
}

function validateRoleDefinitions(
  roles: Record<string, RoleDefinition>
): void {
  const visited = new Set<string>();
  const activePath = new Set<string>();

  const visit = (roleKey: string) => {
    if (activePath.has(roleKey)) {
      throw new Error(
        `Circular role inheritance detected involving "${roleKey}".`
      );
    }

    if (visited.has(roleKey)) {
      return;
    }

    const role = assertRoleExists(roles, roleKey);

    activePath.add(roleKey);

    for (const inheritedRoleKey of role.inherits ?? []) {
      if (!roles[inheritedRoleKey]) {
        throw new Error(
          `Role "${roleKey}" inherits from missing role "${inheritedRoleKey}".`
        );
      }

      visit(inheritedRoleKey);
    }

    activePath.delete(roleKey);
    visited.add(roleKey);
  };

  for (const roleKey of Object.keys(roles)) {
    visit(roleKey);
  }
}

function isScopeMatch(scope: ResourceScope, check: AccessCheck): boolean {
  if (scope === "any") {
    return true;
  }

  if (scope === "own") {
    return check.user.id === check.resourceOwnerId;
  }

  if (!check.resourceTeamId || !check.user.teamIds) {
    return false;
  }

  return check.user.teamIds.includes(check.resourceTeamId);
}

function flattenRolePermissions(
  roles: Record<string, RoleDefinition>,
  roleKey: string,
  visited = new Set<string>()
): PermissionGrant[] {
  if (visited.has(roleKey)) {
    return [];
  }

  visited.add(roleKey);

  const role = assertRoleExists(roles, roleKey);

  const inherited = (role.inherits ?? []).flatMap((parentRoleKey) =>
    flattenRolePermissions(roles, parentRoleKey, visited)
  );

  return [...inherited, ...role.permissions];
}

export function resolveUserPermissions(
  roles: Record<string, RoleDefinition>,
  roleKeys: string[]
): PermissionGrant[] {
  return roleKeys.flatMap((roleKey) => flattenRolePermissions(roles, roleKey));
}

export function isAllowed(
  permissions: PermissionGrant[],
  check: AccessCheck
): AccessDecision {
  const relevantPermissions = permissions.filter(
    (permission) =>
      permission.resource === check.resource && permission.action === check.action
  );

  if (relevantPermissions.length === 0) {
    return {
      allowed: false,
      reason: "No matching permission grant found.",
      matchedScopes: []
    };
  }

  const denied = relevantPermissions.find((permission) => {
    const scope = permission.scope ?? "any";
    const conditionPassed = permission.condition
      ? permission.condition({
          user: check.user,
          resource: check.resourceData
        })
      : true;

    return (
      permission.effect === "deny" &&
      conditionPassed &&
      isScopeMatch(scope, check)
    );
  });

  if (denied) {
    return {
      allowed: false,
      reason: "Access denied by an explicit deny rule.",
      matchedScopes: [denied.scope ?? "any"]
    };
  }

  const allowedScopes = relevantPermissions
    .filter((permission) => (permission.effect ?? "allow") === "allow")
    .filter((permission) => {
      const scope = permission.scope ?? "any";
      const conditionPassed = permission.condition
        ? permission.condition({
            user: check.user,
            resource: check.resourceData
          })
        : true;

      return conditionPassed && isScopeMatch(scope, check);
    })
    .map((permission) => permission.scope ?? "any");

  if (allowedScopes.length === 0) {
    return {
      allowed: false,
      reason: "Permission exists, but resource scope or condition did not match.",
      matchedScopes: []
    };
  }

  return {
    allowed: true,
    reason: "Access allowed.",
    matchedScopes: allowedScopes
  };
}

export function createAccessControl(
  roles: Record<string, RoleDefinition>
): AccessControl {
  validateRoleDefinitions(roles);

  return {
    can(check) {
      const permissions = resolveUserPermissions(roles, check.user.roleKeys);
      return isAllowed(permissions, check);
    },
    getPermissions(roleKeys) {
      return resolveUserPermissions(roles, roleKeys);
    }
  };
}
