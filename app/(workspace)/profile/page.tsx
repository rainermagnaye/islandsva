import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace, WorkspaceSkeleton } from "@/components/layout/workspace";
import { appRoutes, adminUserHref } from "@/content/routes";
import { MyProfile } from "@/features/users/components/my-profile";
import { getStaffProfile, getUser } from "@/features/users/dal";
import { ownProfileHasAvatar } from "@/features/users/service";
import { nameInitials } from "@/features/auth/initials";
import { homeFor } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const user = await requireRole(["admin", "va", "closer"]);
  const [account, profile, hasPhoto] = await Promise.all([getUser(user.id), getStaffProfile(user.id), ownProfileHasAvatar(user.id)]);

  const name = profile?.details.fullName || account?.fullName || "";

  return (
    <Workspace compact>
      <MyProfile
        email={account?.email || user.email}
        fullName={name}
        phone={profile?.details.mobileNumber ?? ""}
        timeFormat={profile?.timeFormat ?? "12"}
        hasPhoto={hasPhoto}
        photoSrc={adminUserHref(user.id) + "/avatar"}
        initials={nameInitials(name || account?.email || user.email)}
        twoFactorEnabled={user.roles.includes("admin")}
        backHref={homeFor(user.roles) ?? appRoutes.dashboard}
      />
    </Workspace>
  );
}
