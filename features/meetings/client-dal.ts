import "server-only";
import { createClient } from "@/lib/supabase/server";
import { UpstreamError } from "@/lib/upstream-error";
import { manilaToIso } from "./contract";
import type { BookingFile } from "./form-data";
import type { BookingInput, BookingNoteInput } from "./validation";

// A client's own meetings, written as the signed-in client: each function checks the caller is an active client,
// that the guests are their own assistants and that the meeting is one they created (supabase/CLAUDE.md).

const CLIENT_REFUSAL: Record<string, string> = {
  IVA01: "That meeting no longer exists, or the agency set it up. Refresh the page.",
  IVA30: "End the meeting after it starts, within 8 hours. A cancelled meeting can't be edited.",
  IVA33: "Invite at most 20 people.",
  IVA34: "You can complete this once the meeting has started.",
  IVA37: "Invite at least one of your assistants.",
  IVA38: "Choose a start time that hasn't passed yet.",
  "42501": "Your account can't book meetings right now. Contact us if this keeps happening.",
};

type Refusal = { code?: string; message: string };

function refused(error: Refusal) {
  return CLIENT_REFUSAL[error.code ?? ""]
    ?? (error.message.includes("attachment") ? "That attachment can't be saved. Use a recording, PDF or image under 2 MB." : null)
    ?? (error.message.includes("note is required") ? "Enter a note." : null);
}

function settle(error: Refusal | null, what: string) {
  if (!error) return { ok: true as const };
  const message = refused(error);
  if (message) return { ok: false as const, message };
  throw new UpstreamError("supabase", `${what} failed: ${error.message}`, { cause: error });
}

export async function insertClientBooking(input: BookingInput, file: BookingFile) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_client_meeting", {
    title: input.title,
    starts_at: manilaToIso(input.startDate, input.startTime),
    ends_at: manilaToIso(input.endDate, input.endTime),
    staff_ids: input.staffIds,
    note: input.note || null,
    attachment_name: file?.name ?? null,
    attachment_type: file?.type ?? null,
    attachment_base64: file?.base64 ?? null,
  });
  return settle(error, "Creating a client meeting");
}

export async function saveClientBooking(input: BookingInput, meetingId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_client_meeting", {
    meeting_id: meetingId,
    title: input.title,
    starts_at: manilaToIso(input.startDate, input.startTime),
    ends_at: manilaToIso(input.endDate, input.endTime),
    staff_ids: input.staffIds,
  });
  return settle(error, "Saving a client meeting");
}

export async function cancelClientBookingRow(meetingId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_client_meeting", { meeting_id: meetingId });
  return settle(error, "Cancelling a client meeting");
}

export async function completeClientBookingRow(meetingId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_client_meeting", { meeting_id: meetingId });
  return settle(error, "Completing a client meeting");
}

export async function insertClientBookingNote(input: BookingNoteInput, file: BookingFile) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_client_meeting_note", {
    meeting_id: input.meetingId,
    note: input.note,
    attachment_name: file?.name ?? null,
    attachment_type: file?.type ?? null,
    attachment_base64: file?.base64 ?? null,
  });
  return settle(error, "Saving a client meeting note");
}

/** Accept or decline a meeting the client's VA asked for. Only a request still waiting on this client's company. */
export async function answerVaMeetingRow(meetingId: string, accept: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("answer_va_meeting", { meeting_id: meetingId, accept });
  if (error?.code === "IVA01") return { ok: false as const, message: "That request was already answered or cancelled. Refresh the page." };
  if (error?.code === "IVA38") return { ok: false as const, message: "This meeting's time has passed. Ask your VA to book a new one." };
  return settle(error, "Answering a VA meeting");
}
