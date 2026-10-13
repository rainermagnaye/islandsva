import type { Role } from "@/lib/auth/roles";
import type { Enums } from "@/types/database";

// Shared by the invite form and the server. No Zod: the form imports this file.

/** Roles an admin can invite directly. Clients are invited by a Closer during onboarding (M3). */
export const STAFF_ROLES = ["va", "closer", "admin"] as const satisfies readonly Role[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export const USER_LIMITS = { fullName: 120, email: 254 } as const;

export type InviteField = "email" | "fullName" | "role";

/** One row of the admin user list — only what the screen shows. */
export type UserSummary = {
  id: string;
  email: string;
  fullName: string;
  roles: Role[];
  status: AccountStatus;
  createdAt: string;
};

export type AccountStatus = Enums<"account_status">;

export const STATUS_LABELS: Record<AccountStatus, string> = {
  invited: "Invited",
  active: "Active",
  inactive: "Deactivated",
};
