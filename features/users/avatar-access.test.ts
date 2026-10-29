import { describe, expect, it } from "vitest";
import { maySeeAvatar } from "./avatar-access";

const viewer = "viewer";
const subject = "subject";

describe("maySeeAvatar", () => {
  it("allows the person and an admin", () => {
    expect(maySeeAvatar({ viewerId: subject, roles: ["va"], subjectId: subject, assignedVaIds: [] })).toBe(true);
    expect(maySeeAvatar({ viewerId: viewer, roles: ["admin"], subjectId: subject, assignedVaIds: [] })).toBe(true);
  });

  it("allows a client only for a VA assigned to them", () => {
    expect(maySeeAvatar({ viewerId: viewer, roles: ["client"], subjectId: subject, assignedVaIds: [subject] })).toBe(true);
    expect(maySeeAvatar({ viewerId: viewer, roles: ["client"], subjectId: subject, assignedVaIds: [] })).toBe(false);
  });

  it("refuses everyone else", () => {
    expect(maySeeAvatar({ viewerId: viewer, roles: ["va"], subjectId: subject, assignedVaIds: [subject] })).toBe(false);
    expect(maySeeAvatar({ viewerId: viewer, roles: ["closer"], subjectId: subject, assignedVaIds: [subject] })).toBe(false);
  });
});
