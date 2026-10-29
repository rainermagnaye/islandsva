/** Who may download a profile picture: the person, an admin, or a client assigned to that VA. */
export function maySeeAvatar(input: { viewerId: string; roles: readonly string[]; subjectId: string; assignedVaIds: readonly string[] }) {
  if (input.viewerId === input.subjectId) return true;
  if (input.roles.includes("admin")) return true;
  return input.roles.includes("client") && input.assignedVaIds.includes(input.subjectId);
}
