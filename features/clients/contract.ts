import type { Enums } from "@/types/database";

// Shared by the admin pages and the server. No Zod: components import this file.

export type ClientStatus = Enums<"client_status">;

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  pending: "Pending",
  active: "Active",
  inactive: "Inactive",
};

/** One row of the admin client list — only what the screen shows. */
export type ClientSummary = {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  status: ClientStatus;
  /** Who created the record (a Closer, or an admin converting a lead). */
  createdBy: string;
  createdAt: string;
};

/** A page of clients, newest first. */
export type ClientPage = { clients: ClientSummary[]; total: number; page: number; pageCount: number };
