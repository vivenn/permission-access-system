import type { AccessControl, AccessCheck } from "../types/access-control.js";

export interface PermissionAuthShape {
  userId: string;
  roles: string[];
  teamIds?: string[];
}

export interface PermissionUserShape {
  id?: string;
  userId?: string;
  roles?: string[];
  roleKeys?: string[];
  teamIds?: string[];
  teams?: string[];
  [key: string]: unknown;
}

export interface PermissionRecordShape {
  ownerId?: string;
  teamId?: string;
  [key: string]: unknown;
}

export interface PermissionRequestShape {
  auth?: PermissionAuthShape;
  user?: PermissionUserShape;
  params?: Record<string, string | undefined>;
  record?: PermissionRecordShape;
  [key: string]: unknown;
}

interface PermissionResponseShape {
  status(code: number): {
    json(body: unknown): unknown;
  };
}

type NextFunction = (error?: unknown) => void;

type MaybePromise<T> = T | Promise<T>;

export interface PermissionRecordContext {
  resourceOwnerId?: string;
  resourceTeamId?: string;
  resourceData?: Record<string, unknown>;
}

export type PermissionRecordLoader = (
  req: PermissionRequestShape,
  res: PermissionResponseShape
) => MaybePromise<PermissionRecordShape | void>;

export interface RequirePermissionOptions {
  loadRecord?: PermissionRecordLoader;
  getUser?: (
    req: PermissionRequestShape,
    res: PermissionResponseShape
  ) => MaybePromise<{
    id: string;
    roleKeys: string[];
    teamIds?: string[];
  } | void>;
  getRecordContext?: (
    req: PermissionRequestShape,
    res: PermissionResponseShape
  ) => MaybePromise<PermissionRecordContext | void>;
}

export function requirePermission(
  accessControl: AccessControl,
  resource: string,
  action: string,
  optionsOrLoadRecord?: RequirePermissionOptions | PermissionRecordLoader
) {
  const options = normalizeRequirePermissionOptions(optionsOrLoadRecord);

  return (
    req: PermissionRequestShape,
    res: PermissionResponseShape,
    next: NextFunction
  ) => {
    void (async () => {
      const user = await resolveRequestUser(req, res, options);

      if (!user) {
        return res.status(401).json({
          error: {
            code: "UNAUTHORIZED",
            message: "Missing request user context."
          }
        });
      }

      if (options?.loadRecord) {
        const loadedRecord = await options.loadRecord(req, res);

        if (loadedRecord !== undefined) {
          req.record = loadedRecord;
        }
      }

      const recordContext = await resolveRecordContext(req, res, options);

      const check: AccessCheck = {
        user,
        resource,
        action,
        resourceOwnerId: recordContext.resourceOwnerId,
        resourceTeamId: recordContext.resourceTeamId,
        resourceData: recordContext.resourceData
      };

      const decision = accessControl.can(check);

      if (!decision.allowed) {
        return res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: decision.reason
          }
        });
      }

      next();
    })().catch((error) => {
      next(error);
    });
  };
}

function normalizeRequirePermissionOptions(
  optionsOrLoadRecord?: RequirePermissionOptions | PermissionRecordLoader
): RequirePermissionOptions {
  if (typeof optionsOrLoadRecord === "function") {
    return {
      loadRecord: optionsOrLoadRecord
    };
  }

  return optionsOrLoadRecord ?? {};
}

async function resolveRequestUser(
  req: PermissionRequestShape,
  res: PermissionResponseShape,
  options: RequirePermissionOptions
) {
  if (options.getUser) {
    return options.getUser(req, res);
  }

  if (req.auth) {
    return {
      id: req.auth.userId,
      roleKeys: req.auth.roles,
      teamIds: req.auth.teamIds
    };
  }

  if (!req.user) {
    return undefined;
  }

  const userId = req.user.id ?? req.user.userId;
  const roleKeys = req.user.roleKeys ?? req.user.roles;
  const teamIds = req.user.teamIds ?? req.user.teams;

  if (!userId || !roleKeys) {
    return undefined;
  }

  return {
    id: userId,
    roleKeys,
    teamIds
  };
}

async function resolveRecordContext(
  req: PermissionRequestShape,
  res: PermissionResponseShape,
  options: RequirePermissionOptions
): Promise<PermissionRecordContext> {
  if (options.getRecordContext) {
    const recordContext = await options.getRecordContext(req, res);
    return recordContext ?? {};
  }

  return {
    resourceOwnerId: req.record?.ownerId,
    resourceTeamId: req.record?.teamId,
    resourceData: req.record
  };
}
