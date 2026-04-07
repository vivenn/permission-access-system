export {
  createAccessControl,
  AccessControlEngine
} from "./core/access-control-engine.js";

export { isAllowed } from "./core/evaluator.js";

export { resolveUserPermissions } from "./core/resolver.js";

export { requirePermission } from "./adapters/express.js";

export type {
  PermissionAuthShape,
  PermissionRecordContext,
  PermissionRecordLoader,
  PermissionRecordShape,
  PermissionRequestShape,
  PermissionUserShape,
  RequirePermissionOptions
} from "./adapters/express.js";

export type {
  AccessCheck,
  AccessControl,
  AccessControlConfigInput,
  AccessDecision,
  ConditionContext,
  JsonAccessControlConfig,
  JsonConditionDefinition,
  JsonConditionOperator,
  JsonConditionSource,
  JsonPermissionGrant,
  JsonRoleDefinition,
  PermissionGrant,
  ResourceScope,
  RoleDefinition,
  UserContext
} from "./types/access-control.js";
