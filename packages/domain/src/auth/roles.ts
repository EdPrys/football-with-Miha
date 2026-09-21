/** Roles ordered by privilege. Higher includes everything lower can do. */
export const ROLE_ORDER = {
  PLAYER: 0,
  MANAGER: 1,
  ADMIN: 2,
} as const;

export type RoleName = keyof typeof ROLE_ORDER;

/** True when `role` is at least as privileged as `required`. */
export function roleAtLeast(role: RoleName, required: RoleName): boolean {
  return ROLE_ORDER[role] >= ROLE_ORDER[required];
}
