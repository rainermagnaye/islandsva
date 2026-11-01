"use client";

import { lazy, Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FilterMenu } from "@/components/ui/filter-menu";
import { IconBadge } from "@/components/ui/icon-badge";
import { Modal } from "@/components/ui/modal";
import { appRoutes } from "@/content/routes";
import { CLIENT_STATUS_LABELS, type ClientStatus } from "../contract";

const CreateClientForm = lazy(() => import("./create-client-form").then((module) => ({ default: module.CreateClientForm })));

type ClientFilter = ClientStatus | "disabled";

const STATUS_OPTIONS: { value: ClientFilter; label: string }[] = [
  ...(Object.keys(CLIENT_STATUS_LABELS) as ClientStatus[]).map((value) => ({ value, label: CLIENT_STATUS_LABELS[value] })),
  { value: "disabled", label: "Disabled" },
];

/** Filter and Create new, beside the search. Create new adds a pending client with no lead. */
export function ClientsToolbar({
  status,
  disabled,
  query,
  path = appRoutes.adminClients,
  createHref,
}: {
  status?: ClientStatus;
  disabled?: boolean;
  query?: string;
  path?: string;
  /** A page to add a client; omit it to keep the admin's Create-new modal. */
  createHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const value: ClientFilter | undefined = disabled ? "disabled" : status;

  function filterBy(next: ClientFilter | undefined) {
    const params = new URLSearchParams();
    if (next === "disabled") params.set("disabled", "1");
    else if (next) params.set("status", next);
    if (query) params.set("q", query);
    const search = params.toString();
    router.push(search ? `${path}?${search}` : path);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <FilterMenu options={STATUS_OPTIONS} value={value} onChange={filterBy} allLabel="All Clients" />
      {createHref ? (
        <Button href={createHref} iconLeft="plus">
          New client
        </Button>
      ) : (
        <>
          <Button
            iconLeft="plus"
            onClick={() => {
              setAdded(false);
              setFormKey((key) => key + 1);
              setOpen(true);
            }}
          >
            Create new
          </Button>
          <Modal
            open={open}
            onClose={() => setOpen(false)}
            align={added ? "center" : "start"}
            icon={added ? <IconBadge name="check" tone="success" size="xl" /> : undefined}
            title={added ? "Client added" : "Create a client"}
            description={added ? "You've successfully added a new client to the list." : "They start as pending. You can send their registration link from the client profile."}
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
            {open && !added ? (
              <Suspense fallback={null}>
                <CreateClientForm key={formKey} onAdded={() => setAdded(true)} />
              </Suspense>
            ) : null}
          </Modal>
        </>
      )}
    </div>
  );
}
