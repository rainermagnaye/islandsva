"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { BusyTime } from "../slot-times";
import { AddSlotsForm } from "./add-slots-form";

/** "Add demo slots" in the page header, opening the form in the shared Modal. */
export function AddSlotsButton(props: { today: string; last: string; busy: readonly BusyTime[]; offered: readonly string[]; windows: readonly { weekday: number; startMinute: number; endMinute: number }[] }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  return (
    <>
      <Button
        iconLeft="plus"
        onClick={() => {
          setFormKey((key) => key + 1);
          setOpen(true);
        }}
      >
        Add demo slots
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="wide"
        title="Add demo slots"
        description="Pick a day and the half hours you can take a 30-minute demo call, in Manila time. Clients see them in their own zone."
      >
        {open && <AddSlotsForm key={formKey} {...props} onAdded={() => setOpen(false)} />}
      </Modal>
    </>
  );
}
