import { emptyStaffDetails, isVaAccount, registrationStatus, registrationSteps, staffAccessBadge, staffSections, type StaffDetails, type UserSummary } from "../contract";
import type { StaffProfileRecord } from "../dal";
import type { StaffProfileMeta } from "../profile-fields";
import { StaffProfileScreen } from "./staff-profile-screen";

/**
 * One staff member. The page reads the saved profile; the screen switches between that view and the form.
 */
export function StaffProfile({
  user,
  actorId,
  profile,
  hasHistory,
}: {
  user: UserSummary;
  actorId: string;
  profile: StaffProfileRecord | null;
  hasHistory: boolean;
}) {
  const details: StaffDetails = { ...(profile?.details ?? emptyStaffDetails(user.fullName)), fullName: profile?.details.fullName || user.fullName };
  const sections = profile?.sections ?? staffSections(details);
  const status = registrationStatus(sections);
  const review = profile?.reviewStatus ?? "pending";
  const signedIn = user.signedInAt !== null;
  const steps = registrationSteps(sections, { signedIn, review, returned: profile?.returnedSections ?? [] });
  const access = staffAccessBadge({ roles: user.roles, accountStatus: user.status, review: profile?.reviewStatus ?? null, signedIn });
  const meta: StaffProfileMeta = {
    registrationStatus: status,
    invitationSentAt: profile?.invitationSentAt ?? user.createdAt,
    registrationCompletedAt: status === "completed" ? (profile?.registrationCompletedAt ?? null) : null,
    progress: steps.find((step) => step.current)?.label ?? "Invitation sent",
  };

  return (
    <StaffProfileScreen
      user={user}
      actorId={actorId}
      details={details}
      resumeType={profile?.resumeType ?? null}
      steps={steps}
      meta={meta}
      hasHistory={hasHistory}
      access={access}
      review={isVaAccount(user.roles) ? review : null}
      returnNote={profile?.returnNote ?? null}
    />
  );
}
