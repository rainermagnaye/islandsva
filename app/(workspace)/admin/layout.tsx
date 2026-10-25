import { AdminShell } from "./_components/admin-shell";

/**
 * Admin shell (the design system's DashboardShell): menu beside the page — a 76px icon rail from 768px,
 * the full 264px sidebar from 1024px — or above it on phones. The menu is static, so it shows
 * instantly; only the new-lead badge reads the session. Access is still checked by every page and
 * action — this layout never authorizes anything.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
