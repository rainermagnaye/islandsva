"use server";

import { refresh } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { FORM_ERROR, formEntries, outageResult, toSubmitResult } from "@/lib/validation";
import type { SubmitResult } from "@/types/form";
import type { SlotField } from "./contract";
import { deleteSlot, insertSlots } from "./dal";
import { parseNewSlots, parseSlotId } from "./validation";

// VA calendar actions. The session is checked first (a VA), then RLS on demo_slots decides: only an open VA's
// own future slots are added or deleted.

/** "Add slots": a date and checked times. Times the VA already offers are kept as they are. */
export async function addDemoSlots(formData: FormData): Promise<SubmitResult<SlotField>> {
  const user = await requireRole(["va"]);
  const parsed = parseNewSlots({ ...formEntries(formData), times: formData.getAll("times") });
  if (!parsed.ok) return toSubmitResult(parsed);
  try {
    const result = await insertSlots(user.id, parsed.value.startsAt);
    if (!result.ok) {
      return {
        ok: false,
        message: result.reason === "not_allowed" ? "Your calendar opens once your profile is approved." : "Those times can't be added. Pick times up to 30 days ahead.",
      };
    }
  } catch (error) {
    return outageResult(error, "Adding slots");
  }
  refresh();
  return { ok: true };
}

/** Removes one open slot. A slot a client has booked stays: decide the request instead. */
export async function deleteDemoSlot(slotId: unknown): Promise<SubmitResult> {
  const user = await requireRole(["va"]);
  const parsed = parseSlotId({ slotId });
  if (!parsed.ok) return { ok: false, message: FORM_ERROR };
  try {
    if (!(await deleteSlot(user.id, parsed.value.slotId))) {
      return { ok: false, message: "That slot is booked or already passed, so it stays. Refresh the page." };
    }
  } catch (error) {
    return outageResult(error, "Deleting a slot");
  }
  refresh();
  return { ok: true };
}
