import { emptyStaffDetails, registrationSteps, staffSections, type StaffDetails, type UserSummary } from "../contract";
import type { StaffProfileRecord } from "../dal";
import { StaffProfileScreen } from "./staff-profile-screen";

/**
 * One staff member. The page reads the saved profile; the screen switches between that view and the form.
 */
export function StaffProfile({
  user,
  actorId,
  profile,
}: {
  user: UserSummary;
  actorId: string;
  profile: StaffProfileRecord | null;
}) {
  const details: StaffDetails = { ...(profile?.details ?? emptyStaffDetails(user.fullName)), fullName: profile?.details.fullName || user.fullName };
  const sections = profile?.sections ?? staffSections(details);

  return <StaffProfileScreen user={user} actorId={actorId} details={details} steps={registrationSteps(sections)} />;
}
