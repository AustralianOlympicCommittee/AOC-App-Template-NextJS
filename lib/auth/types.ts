export const APP_ROLES = ["App.Read", "App.Write", "App.Admin"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type AuthenticatedUser = {
  displayName: string;
  email?: string;
  expiresAt: number;
  id: string;
  roles: AppRole[];
  tenantId: string;
  username: string;
};

const roleRank: Record<AppRole, number> = {
  "App.Read": 1,
  "App.Write": 2,
  "App.Admin": 3
};

export function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

export function normaliseAppRoles(values: unknown): AppRole[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return [...new Set(values.map(String).filter(isAppRole))];
}

export function hasAppRole(user: AuthenticatedUser, requiredRole: AppRole) {
  const requiredRank = roleRank[requiredRole];
  return user.roles.some((role) => roleRank[role] >= requiredRank);
}

