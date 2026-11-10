import { emptyEmployeeDetails, isVaAccount, registrationStatus, registrationSteps, employeeAccessBadge, employeeSections, type EmployeeDetails, type UserSummary } from "../contract";
import type { EmployeeProfileRecord } from "../employee-dal";
import type { EmployeeProfileMeta } from "../profile-fields";
import { EmployeeProfileScreen } from "./employee-profile-screen";

/**
 * One employee. The page reads the saved profile; the screen switches between that view and the form.
 */
export function EmployeeProfile({
  user,
  actorId,
  profile,
  hasHistory,
  invitedAt,
}: {
  user: UserSummary;
  actorId: string;
  profile: EmployeeProfileRecord | null;
  hasHistory: boolean;
  /** When Supabase Auth last sent the invite email; null if the account was created without one. */
  invitedAt: string | null;
}) {
  const details: EmployeeDetails = { ...(profile?.details ?? emptyEmployeeDetails(user.fullName)), fullName: profile?.details.fullName || user.fullName };
  const sections = profile?.sections ?? employeeSections(details);
  const status = registrationStatus(sections);
  const review = profile?.reviewStatus ?? "pending";
  const signedIn = user.signedInAt !== null;
  const invited = invitedAt !== null;
  const steps = registrationSteps(sections, { signedIn, review, returned: profile?.returnedSections ?? [], invited });
  const access = employeeAccessBadge({ roles: user.roles, accountStatus: user.status, review: profile?.reviewStatus ?? null, signedIn, invited });
  const meta: EmployeeProfileMeta = {
    registrationStatus: status,
    createdAt: user.createdAt,
    invitationSentAt: invitedAt,
    registrationCompletedAt: status === "completed" ? (profile?.registrationCompletedAt ?? null) : null,
    progress: steps.find((step) => step.current)?.label ?? "Invitation sent",
    timeFormat: profile?.timeFormat ?? "12",
  };

  return (
    <EmployeeProfileScreen
      user={user}
      actorId={actorId}
      details={details}
      steps={steps}
      meta={meta}
      hasHistory={hasHistory}
      access={access}
      review={isVaAccount(user.roles) ? review : null}
      returnNote={profile?.returnNote ?? null}
    />
  );
}
