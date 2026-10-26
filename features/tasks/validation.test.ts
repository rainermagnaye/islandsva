import { describe, expect, it } from "vitest";
import { FORM_ERROR } from "@/lib/validation";
import { parseComment, parseCreate, parseStatus, parseUpdate } from "./validation";

const day = "2026-11-02";

describe("task validation", () => {
  it("accepts a title and a real date, and trims the title", () => {
    expect(parseCreate({ title: "  Call the vendor  ", deadline: day })).toEqual({
      ok: true,
      value: { title: "Call the vendor", deadline: day },
    });
  });

  it("rejects extra keys, a blank title and a date that is not a day", () => {
    expect(parseCreate({ title: "Call", deadline: day, extra: true })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseCreate({ title: "   ", deadline: day })).toMatchObject({ ok: false, fieldErrors: { title: "Enter a title." } });
    expect(parseCreate({ title: "Call", deadline: "2026-02-31" })).toMatchObject({ ok: false, fieldErrors: { deadline: "Choose a date." } });
    expect(parseCreate({ title: "Call", deadline: day, vaId: "not-an-id" })).toMatchObject({ ok: false, fieldErrors: { vaId: "Choose the VA this task is for." } });
  });

  it("rejects extra keys on update, status and comment", () => {
    const taskId = "00000000-0000-4000-8000-000000000001";
    expect(parseUpdate({ taskId, title: "Call", deadline: day, note: "nope" })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseStatus({ taskId, status: "todo", extra: 1 })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseStatus({ taskId, status: "sideways" })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseComment({ taskId, body: "On it.", file: "x" })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseComment({ taskId: "nope", body: "On it." })).toEqual({ ok: false, formError: FORM_ERROR });
    expect(parseComment({ taskId, body: "On it." })).toEqual({ ok: true, value: { taskId, body: "On it." } });
  });
});
