import { emptyEmployeeDetails, openReviewSections, registrationStatus, registrationSteps, employeeSections, type UserSummary } from "../contract";
import type { EmployeeProfileRecord } from "../dal";
import type { EmployeeProfileMeta } from "../profile-fields";
import { EmployeeProfileForm } from "./employee-profile-form";
import { EmployeeProfileView } from "./employee-profile-view";

/** The profile on one page. A return shows only the sections that still need a change. Sending it hands the profile to an admin. */
export function VaRegistration({ user, profile }: { user: UserSummary; profile: EmployeeProfileRecord | null }) {
  const details = { ...(profile?.details ?? emptyEmployeeDetails(user.fullName)), fullName: profile?.details.fullName || user.fullName };
  const sections = profile?.sections ?? employeeSections(details);
  const review = profile?.reviewStatus ?? "pending";
  const returned = profile?.returnedSections ?? [];
  const steps = registrationSteps(sections, { signedIn: user.signedInAt !== null, review, returned });
  const status = registrationStatus(sections);
  const meta: EmployeeProfileMeta = {
    registrationStatus: status,
    invitationSentAt: profile?.invitationSentAt ?? user.createdAt,
    registrationCompletedAt: status === "completed" ? (profile?.registrationCompletedAt ?? null) : null,
    progress: steps.find((item) => item.current)?.label ?? "Invitation sent",
    timeFormat: profile?.timeFormat ?? "12",
  };

  if (review === "pending_review") {
    return <EmployeeProfileView userId={user.id} details={details} email={user.email} meta={meta} />;
  }

  return (
    <EmployeeProfileForm
      userId={user.id}
      email={user.email}
      details={details}
      meta={meta}
      profilePic={null}
      mode="review"
      sections={openReviewSections(sections, returned)}
    />
  );
}
