"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FilterMenu } from "@/components/ui/filter-menu";
import { Modal } from "@/components/ui/modal";
import { appRoutes } from "@/content/routes";
import { LEAD_VIEWS, type LeadView } from "../contract";
import { CreateLeadForm } from "./create-lead-form";

const STATUS_OPTIONS = (Object.keys(LEAD_VIEWS) as LeadView[]).map((value) => ({ value, label: LEAD_VIEWS[value] }));

/** Filter and Create Lead, in the same places as the team list. Both keep the current search. */
export function LeadsToolbar({ status, query }: { status?: LeadView; query?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function filterBy(next: LeadView | undefined) {
    const params = new URLSearchParams();
    if (next) params.set("status", next);
    if (query) params.set("q", query);
    const search = params.toString();
    router.push(search ? `${appRoutes.adminLeads}?${search}` : appRoutes.adminLeads);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FilterMenu options={STATUS_OPTIONS} value={status} onChange={filterBy} allLabel="All Leads" />
      <Button
        iconLeft="plus"
        onClick={() => {
          setFormKey((key) => key + 1);
          setOpen(true);
        }}
      >
        Create Lead
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Create a lead"
        description="For someone who didn't use the discovery form. They'll show up in the list as New."
      >
        {open ? <CreateLeadForm key={formKey} /> : null}
      </Modal>
    </div>
  );
}
