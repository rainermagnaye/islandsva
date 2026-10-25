"use client";

import { lazy, Suspense, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { decideDemoAction } from "../booking-actions";

// React.lazy keeps the decline dialog (Modal, Form, TextField) out of /va's first load, which sits at the
// 160 KB budget; it loads when the VA clicks Decline.
const DeclineDemoDialog = lazy(() => import("./decline-demo-dialog").then((m) => ({ default: m.DeclineDemoDialog })));

/** Confirm (one click) or decline (with an optional reason the client sees) a pending demo request. */
export function AnswerDemoButtons({ bookingId, companyName }: { bookingId: string; companyName: string }) {
  const [pending, startTransition] = useTransition();
  const [declining, setDeclining] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function confirm() {
    setProblem(null);
    const formData = new FormData();
    formData.set("bookingId", bookingId);
    formData.set("decision", "confirmed");
    startTransition(async () => {
      const result = await decideDemoAction(formData);
      if (!result.ok) setProblem(result.message);
    });
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" iconLeft="check" loading={pending} onClick={confirm} aria-label={`Confirm the demo with ${companyName}`}>
          Confirm
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setDeclining(true)} aria-label={`Decline the demo with ${companyName}`}>
          Decline
        </Button>
      </div>
      {problem && <Alert tone="danger" title={problem} />}
      {declining && (
        <Suspense fallback={null}>
          <DeclineDemoDialog bookingId={bookingId} companyName={companyName} onClose={() => setDeclining(false)} />
        </Suspense>
      )}
    </div>
  );
}
