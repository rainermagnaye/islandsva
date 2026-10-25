import { emptyStaffDetails, openReviewSections, registrationStatus, registrationSteps, staffSections, type UserSummary } from "../contract";
import type { StaffProfileRecord } from "../dal";
import type { StaffProfileMeta } from "../profile-fields";
import { StaffProfileForm } from "./staff-profile-form";
import { StaffProfileView } from "./staff-profile-view";

/** The profile on one page. A return shows only the sections that still need a change. Sending it hands the profile to an admin. */
export function VaRegistration({ user, profile }: { user: UserSummary; profile: StaffProfileRecord | null }) {
  const details = { ...(profile?.details ?? emptyStaffDetails(user.fullName)), fullName: profile?.details.fullName || user.fullName };
  const sections = profile?.sections ?? staffSections(details);
  const review = profile?.reviewStatus ?? "pending";
  const returned = profile?.returnedSections ?? [];
  const steps = registrationSteps(sections, { signedIn: user.signedInAt !== null, review, returned });
  const status = registrationStatus(sections);
  const meta: StaffProfileMeta = {
    registrationStatus: status,
    invitationSentAt: profile?.invitationSentAt ?? user.createdAt,
    registrationCompletedAt: status === "completed" ? (profile?.registrationCompletedAt ?? null) : null,
    progress: steps.find((item) => item.current)?.label ?? "Invitation sent",
    timeFormat: profile?.timeFormat ?? "12",
  };

  if (review === "pending_review") {
    return <StaffProfileView userId={user.id} details={details} email={user.email} meta={meta} />;
  }

  return (
    <StaffProfileForm
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
