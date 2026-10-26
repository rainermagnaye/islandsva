"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { FORM_ERROR, formEntries, outageResult, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { HoursField, OfferField } from "./validation";
import { decideOffer, offerVa, removeWorkingHours, saveWorkingHours, withdrawOffer } from "./dal";
import { parseDecision, parseHours, parseOffer, parseRemoveHours, parseWithdraw } from "./validation";

const COPY = {
  offer: "That VA can't be offered. Refresh the page and choose another.",
  decided: "That offer can no longer be changed. Refresh the page.",
  hours: "Those hours can't be saved. Use a half hour, and end after the start.",
  missing: "That no longer exists. Refresh the page.",
} as const;

/** An admin offers one VA to a client. */
export async function offerClientVa(formData: FormData): Promise<SubmitResult<OfferField>> {
  const user = await requireRole(["admin"]);
  const parsed = parseOffer(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const saved = await offerVa(parsed.value.clientId, parsed.value.vaId, user.id);
    if (!saved.ok) return { ok: false, message: COPY[saved.form] };
  } catch (error) {
    return outageResult(error, "Offering a VA");
  }
  refresh();
  return { ok: true };
}

/** The client accepts or declines one offer. Accept creates the assignment. */
export async function decideShortlist(formData: FormData): Promise<SubmitResult> {
  await requireRole(["client"]);
  const parsed = parseDecision(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const saved = await decideOffer(parsed.value.shortlistId, parsed.value.status);
    if (!saved.ok) return { ok: false, message: COPY[saved.form] };
  } catch (error) {
    return outageResult(error, "Deciding an offer");
  }
  refresh();
  return { ok: true };
}

/** An admin removes an offer that has not been accepted. */
export async function withdrawShortlist(formData: FormData): Promise<SubmitResult> {
  await requireRole(["admin"]);
  const parsed = parseWithdraw(formEntries(formData));
  if (!parsed.ok) return { ok: false, message: FORM_ERROR };
  try {
    const saved = await withdrawOffer(parsed.value.shortlistId);
    if (!saved.ok) return { ok: false, message: COPY[saved.form] };
  } catch (error) {
    return outageResult(error, "Withdrawing an offer");
  }
  refresh();
  return { ok: true };
}

/** The VA saves one weekday window, in Philippine time. */
export async function saveHours(formData: FormData): Promise<SubmitResult<HoursField>> {
  const user = await requireRole(["va"]);
  const parsed = parseHours(formEntries(formData));
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const saved = await saveWorkingHours(user.id, parsed.value.weekday, parsed.value.startMinute, parsed.value.endMinute);
    if (!saved.ok) return { ok: false, message: COPY[saved.form] };
  } catch (error) {
    return outageResult(error, "Saving working hours");
  }
  refresh();
  return { ok: true };
}

/** The VA removes one weekday window. */
export async function removeHours(formData: FormData): Promise<SubmitResult> {
  const user = await requireRole(["va"]);
  const parsed = parseRemoveHours(formEntries(formData));
  if (!parsed.ok) return { ok: false, message: FORM_ERROR };
  try {
    const saved = await removeWorkingHours(user.id, parsed.value.weekday);
    if (!saved.ok) return { ok: false, message: COPY.missing };
  } catch (error) {
    return outageResult(error, "Removing working hours");
  }
  refresh();
  return { ok: true };
}
