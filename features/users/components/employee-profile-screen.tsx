"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import type { AccessBadge, RegistrationStep, EmployeeDetails, EmployeeReviewStatus, UserSummary } from "../contract";
import type { EmployeeProfileMeta } from "../profile-fields";
import { EmployeeReviewActions } from "./employee-review-actions";
import { EmployeeProfileForm } from "./employee-profile-form";
import { RegistrationStepper, EmployeeProfileView } from "./employee-profile-view";
import { ProfileMenu } from "./employee-profile-menu";

/**
 * The profile opens read-only. Confirm and return sit on the right; edit, disable and delete are in the menu beside them.
 * Delete stays available only when the account has no client or assignment history.
 */
export function EmployeeProfileScreen({
  user,
  actorId,
  details,
  steps,
  meta,
  hasHistory,
  access,
  review,
  returnNote,
}: {
  user: UserSummary;
  actorId: string;
  details: EmployeeDetails;
  steps: RegistrationStep[];
  meta: EmployeeProfileMeta;
  hasHistory: boolean;
  access: AccessBadge;
  /** Set for a VA. Null for a Closer or an admin, who are not on this gate. */
  review: EmployeeReviewStatus | null;
  returnNote: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pictureVersion, setPictureVersion] = useState(0);
  const name = details.fullName || user.email;
  const ownAccount = user.id === actorId;

  function choosePhoto(file: File | undefined) {
    const next = file && file.size > 0 ? file : null;
    setProfilePic(next);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return next ? URL.createObjectURL(next) : null;
    });
  }

  function stopEditing(saved: boolean) {
    setEditing(false);
    setProfilePic(null);
    if (saved) {
      setPictureVersion(Date.now());
      return;
    }
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }

  return (
    <div className="grid gap-4">
      <Card as="header" padding="sm" className="flex flex-wrap items-center gap-3">
        <div className="relative size-12 shrink-0">
          <Avatar key={preview ?? `${user.id}-${pictureVersion}`} name={name} src={preview ?? `/admin/users/${user.id}/avatar?v=${pictureVersion}`} />
          {editing && (
            <label className="absolute inset-0 grid cursor-pointer place-items-end overflow-hidden rounded-lg" title="Change picture">
              <span className="w-full bg-ink/80 text-center type-caption text-surface-card">Edit</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choosePhoto(event.target.files?.[0])} className="sr-only" />
            </label>
          )}
        </div>
        <h1 className="m-0 min-w-0 truncate type-h3">{name}</h1>
        <Badge tone={access.tone} size="sm" dot={access.tone === "neutral"}>
          {access.label}
        </Badge>
        {review === "pending_review" && !editing ? (
          <EmployeeReviewActions
            userId={user.id}
            name={name}
            menu={
              <ProfileMenu
                userId={user.id}
                name={name}
                inactive={user.status === "inactive"}
                ownAccount={ownAccount}
                hasHistory={hasHistory}
                editing={editing}
                onEdit={() => setEditing(true)}
              />
            }
          />
        ) : (
          <div className="ml-auto flex">
            <ProfileMenu
              userId={user.id}
              name={name}
              inactive={user.status === "inactive"}
              ownAccount={ownAccount}
              hasHistory={hasHistory}
              editing={editing}
              onEdit={() => (editing ? stopEditing(false) : setEditing(true))}
            />
          </div>
        )}
      </Card>
      {!access.validated && <RegistrationStepper steps={steps} />}
      {returnNote && review === "pending" && (
        <Alert tone="warning" title="Sent back for a change">
          {returnNote}
        </Alert>
      )}
      {editing ? (
        <EmployeeProfileForm
          userId={user.id}
          email={user.email}
          details={details}
          meta={meta}
          profilePic={profilePic}
          onSaved={() => stopEditing(true)}
          onCancel={() => stopEditing(false)}
        />
      ) : (
        <EmployeeProfileView userId={user.id} details={details} email={user.email} meta={meta} />
      )}
    </div>
  );
}

function Avatar({ name, src }: { name: string; src: string }) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return (
      // A small portrait served by our own route. next/image would add client JS for one 48px picture.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="size-12 shrink-0 rounded-lg object-cover" onError={() => setFailed(true)} />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-surface-sunken type-h4 text-ink" aria-hidden="true">
      {initials || <Icon name="user" size={22} />}
    </span>
  );
}
