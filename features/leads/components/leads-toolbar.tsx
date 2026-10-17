"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FilterMenu } from "@/components/ui/filter-menu";
import { IconBadge } from "@/components/ui/icon-badge";
import { Modal } from "@/components/ui/modal";
import { appRoutes } from "@/content/routes";
import { LEAD_VIEWS, type LeadView } from "../contract";
import { CreateLeadForm } from "./create-lead-form";

const STATUS_OPTIONS = (Object.keys(LEAD_VIEWS) as LeadView[]).map((value) => ({ value, label: LEAD_VIEWS[value] }));

/** Filter and Create Lead, in the same places as the team list. Both keep the current search. */
export function LeadsToolbar({ status, query }: { status?: LeadView; query?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
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
          setAdded(false);
          setFormKey((key) => key + 1);
          setOpen(true);
        }}
      >
        Create Lead
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        align={added ? "center" : "start"}
        icon={added ? <IconBadge name="check" tone="success" size="xl" /> : undefined}
        title={added ? "Lead added" : "Create a lead"}
        description={added ? "You've successfully added a new lead to the list." : undefined}
        footer={
          added ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setAdded(false);
                  setFormKey((key) => key + 1);
                }}
              >
                Add another
              </Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </>
          ) : undefined
        }
      >
        {open && !added ? <CreateLeadForm key={formKey} onAdded={() => setAdded(true)} /> : null}
      </Modal>
    </div>
  );
}
