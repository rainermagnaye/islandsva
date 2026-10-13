import "server-only";
import { z } from "zod";
import { NO_CONTROL_CHARS, emailField, parseWith, tooLong } from "@/lib/validation";
import { STAFF_ROLES, USER_LIMITS, type InviteField } from "./contract";

const inviteSchema = z.strictObject({
  email: emailField(USER_LIMITS.email),
  fullName: z
    .string({ error: "Enter their name." })
    .trim()
    .min(1, "Enter their name.")
    .max(USER_LIMITS.fullName, tooLong("the name", USER_LIMITS.fullName))
    .regex(NO_CONTROL_CHARS, tooLong("the name", USER_LIMITS.fullName)),
  role: z.enum(STAFF_ROLES, { error: "Choose a role." }),
});

export type InviteInput = z.output<typeof inviteSchema>;

export const parseInvite = (input: unknown) => parseWith(inviteSchema, input, ["email", "fullName", "role"] satisfies InviteField[]);
