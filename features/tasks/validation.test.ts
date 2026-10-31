import { describe, expect, it } from "vitest";
import { FORM_ERROR } from "@/lib/validation";
import { parseAttach, parseComment, parseCommentDelete, parseCommentEdit, parseCreate, parseDelete, parseFeedback, parseStatus, parseSubmit, parseUpdate } from "./validation";

const day = "2026-11-02";

describe("task validation", () => {
  it("accepts a title and a real date, and trims the title", () => {
    expect(parseCreate({ title: "  Call the vendor  ", deadline: day, deadlineTime: "17:00" })).toEqual({
      ok: true,
      value: { title: "Call the vendor", deadline: day, deadlineTime: "17:00" },
    });
    expect(parseCreate({ title: "Call", deadline: day, deadlineTime: "17:00:30" })).toMatchObject({
      ok: true,
      value: { deadlineTime: "17:00" },
    });
  });

  it("rejects extra keys, a blank title and a date that is not a day", () => {
    expect(parseCreate({ title: "Call", deadline: day, deadlineTime: "17:00", extra: true })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseCreate({ title: "   ", deadline: day, deadlineTime: "17:00" })).toMatchObject({ ok: false, fieldErrors: { title: "Enter a title." } });
    expect(parseCreate({ title: "Call", deadline: "2026-02-31", deadlineTime: "17:00" })).toMatchObject({ ok: false, fieldErrors: { deadline: "Choose a date." } });
    expect(parseCreate({ title: "Call", deadline: day, deadlineTime: "25:00" })).toMatchObject({ ok: false, fieldErrors: { deadlineTime: "Choose a time." } });
    expect(parseCreate({ title: "Call", deadline: day, deadlineTime: "17:00", vaId: "not-an-id" })).toMatchObject({ ok: false, fieldErrors: { vaId: "Choose the VA this task is for." } });
  });

  it("rejects extra keys on update, status and comment", () => {
    const taskId = "00000000-0000-4000-8000-000000000001";
    expect(parseUpdate({ taskId, title: "Call", deadline: day, deadlineTime: "17:00", note: "nope" })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseStatus({ taskId, status: "todo", extra: 1 })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseStatus({ taskId, status: "sideways" })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseComment({ taskId, body: "On it.", file: "x" })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseComment({ taskId: "nope", body: "On it." })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseComment({ taskId, body: "On it." })).toEqual({ ok: true, value: { taskId, body: "On it." } });
    expect(parseDelete({ taskId })).toEqual({ ok: true, value: { taskId } });
    expect(parseDelete({ taskId, extra: true })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseDelete({ taskId: "nope" })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseCommentEdit({ commentId: taskId, body: "Edited." })).toEqual({ ok: true, value: { commentId: taskId, body: "Edited." } });
    expect(parseCommentEdit({ commentId: taskId, body: "   " })).toMatchObject({ ok: false, fieldErrors: { body: "Write a comment." } });
    expect(parseCommentEdit({ commentId: taskId, extra: true })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseCommentDelete({ commentId: taskId })).toEqual({ ok: true, value: { commentId: taskId } });
    expect(parseCommentDelete({ commentId: "nope" })).toEqual({ ok: false, formError: FORM_ERROR });
  });

  it("accepts review as a status", () => {
    const taskId = "00000000-0000-4000-8000-000000000001";
    expect(parseStatus({ taskId, status: "review" })).toEqual({ ok: true, value: { taskId, status: "review" } });
  });

  it("makes the handover note optional and the feedback required", () => {
    const taskId = "00000000-0000-4000-8000-000000000001";
    expect(parseSubmit({ taskId })).toEqual({ ok: true, value: { taskId } });
    expect(parseSubmit({ taskId, note: "" })).toEqual({ ok: true, value: { taskId, note: "" } });
    expect(parseSubmit({ taskId, note: "  In the shared folder  " })).toEqual({ ok: true, value: { taskId, note: "In the shared folder" } });
    expect(parseSubmit({ taskId, note: "x".repeat(2001) })).toMatchObject({ ok: false, fieldErrors: { note: "Keep the note under 2000 characters." } });
    expect(parseSubmit({ taskId, status: "done" })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseFeedback({ taskId, note: "Use the new logo" })).toEqual({ ok: true, value: { taskId, note: "Use the new logo" } });
    expect(parseFeedback({ taskId, note: "   " })).toMatchObject({ ok: false, fieldErrors: { note: "Write what needs to change." } });
    expect(parseFeedback({ taskId })).toMatchObject({ ok: false, fieldErrors: { note: "Write what needs to change." } });
    expect(parseFeedback({ taskId, note: "Bell\u0007" })).toMatchObject({ ok: false, fieldErrors: { note: "Remove any unusual characters from the note." } });
    expect(parseFeedback({ taskId: "nope", note: "Fix it" })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseAttach({ taskId })).toEqual({ ok: true, value: { taskId } });
    expect(parseAttach({ taskId, extra: 1 })).toEqual({ ok: false, formError: FORM_ERROR });
  });

  it("takes a severity, and no longer a duration", () => {
    const base = { title: "Call", deadline: day, deadlineTime: "17:00" };
    expect(parseCreate({ ...base, severity: "high" })).toMatchObject({ ok: true, value: { severity: "high" } });
    expect(parseCreate(base).ok).toBe(true);
    expect(parseCreate({ ...base, severity: "urgent" })).toMatchObject({ ok: false, fieldErrors: { severity: "Choose a severity." } });
    // The task timer is gone (M14 logs hours per client), so a duration is an unknown field.
    expect(parseCreate({ ...base, durationHours: "1", durationMinutes: "30" })).toMatchObject({ ok: false });
    const taskId = "11111111-1111-4111-8111-111111111111";
    expect(parseUpdate({ taskId, ...base, severity: "low" })).toMatchObject({ ok: true, value: { severity: "low" } });
    expect(parseUpdate({ taskId, ...base, durationMinutes: "45" })).toMatchObject({ ok: false });
  });
});
