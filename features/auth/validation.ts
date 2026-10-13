import "server-only";
import { z } from "zod";
import { emailField, parseWith } from "@/lib/validation";
import { PASSWORD_RULES, type EmailField, type MfaField, type NewPasswordField, type SignInField } from "./contract";

const signInSchema = z.strictObject({
  email: emailField(),
  // Only presence and the bcrypt cap here: strength is checked when a password is set, not at sign-in.
  password: z.string({ error: "Enter your password." }).min(1, "Enter your password.").max(PASSWORD_RULES.max, "That password is too long."),
  next: z.string().max(512).optional(),
});

const emailSchema = z.strictObject({ email: emailField() });

const newPasswordSchema = z
  .strictObject({
    password: z
      .string({ error: "Choose a password." })
      .min(PASSWORD_RULES.min, `Use at least ${PASSWORD_RULES.min} characters.`)
      .max(PASSWORD_RULES.max, `Use at most ${PASSWORD_RULES.max} characters.`)
      .regex(/[a-z]/i, "Include at least one letter.")
      .regex(/\d/, "Include at least one number."),
    confirmPassword: z.string({ error: "Type the password again." }),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], error: "The passwords don't match." });

const mfaSchema = z.strictObject({
  factorId: z.uuid(),
  code: z
    .string({ error: "Enter the 6-digit code from your authenticator app." })
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app."),
});

export const parseSignIn = (input: unknown) => parseWith(signInSchema, input, ["email", "password"] satisfies SignInField[]);
export const parseEmail = (input: unknown) => parseWith(emailSchema, input, ["email"] satisfies EmailField[]);
export const parseNewPassword = (input: unknown) =>
  parseWith(newPasswordSchema, input, ["password", "confirmPassword"] satisfies NewPasswordField[]);
export const parseMfaCode = (input: unknown) => parseWith(mfaSchema, input, ["code"] satisfies MfaField[]);
