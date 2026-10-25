"use client";

import { useState, type ReactNode } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { ChangePasswordButton } from "@/features/auth/components/change-password-button";
import { ProfileMenu } from "@/features/auth/components/profile-menu";
import { STAFF_LIMITS, TIME_FORMATS, TIME_FORMAT_LABELS, type MyProfileField, type TimeFormat } from "../contract";
import { saveMyProfile } from "../actions";

const PHOTO_TOO_LARGE = "Keep the profile picture under 512 KB.";
const SAVE_FAILED = "We couldn't save the profile. Check your connection and try again.";

/**
 * Opens as a read-only view. Edit reveals the phone, time format and picture.
 * Name and email stay as text: the name changes on the staff profile, and email is not edited here.
 */
export function MyProfile({
  email,
  fullName,
  phone,
  timeFormat,
  hasPhoto,
  photoSrc,
  initials,
  twoFactorEnabled,
  backHref,
}: {
  email: string;
  fullName: string;
  phone: string;
  timeFormat: TimeFormat;
  hasPhoto: boolean;
  photoSrc: string;
  initials: string;
  twoFactorEnabled: boolean;
  backHref: string;
}) {
  const [editing, setEditing] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [pictureVersion, setPictureVersion] = useState(0);
  const shownPhone = phone.trim() || "Not provided";
  const picture = preview ?? (hasPhoto ? `${photoSrc}?v=${pictureVersion}` : null);

  function choosePhoto(file: File | undefined) {
    const next = file && file.size > 0 ? file : null;
    setPhoto(next);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return next ? URL.createObjectURL(next) : null;
    });
  }

  function stopEditing() {
    setPhoto(null);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setFormKey((key) => key + 1);
    setEditing(false);
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button href={backHref} variant="ghost" size="sm" iconLeft="chevron-left">
            Back
          </Button>
          <h1 className="m-0 type-h1">My Profile</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" iconLeft="mail" type="button">
            Change email
          </Button>
          <ChangePasswordButton />
          <ProfileMenu editing={editing} onEdit={() => setEditing(true)} />
        </div>
      </div>

      {editing ? (
        <Form<MyProfileField>
          key={formKey}
          aria-label="My profile"
          onSubmit={async (formData) => {
            if (photo && photo.size > STAFF_LIMITS.avatarBytes) return { ok: false, message: PHOTO_TOO_LARGE };
            if (photo) formData.set("avatar", photo);
            try {
              const result = await saveMyProfile(formData);
              if (result.ok) {
                setPhoto(null);
                setPreview((current) => {
                  if (current) URL.revokeObjectURL(current);
                  return null;
                });
                setPictureVersion(Date.now());
                setEditing(false);
              }
              return result;
            } catch {
              return { ok: false, message: SAVE_FAILED };
            }
          }}
        >
          {({ pending, fieldErrors }) => (
            <div className="grid gap-4">
              <Section title="Basic info">
                <Readout label="Logged in as" value={email} />
                <Readout label="Full name" value={fullName || "Not provided"} />
                <TextField compact label="Phone" name="mobileNumber" type="tel" optional maxLength={STAFF_LIMITS.phone} defaultValue={phone} error={fieldErrors.mobileNumber} />
                <Select compact label="Time format" name="timeFormat" defaultValue={timeFormat} options={TIME_FORMATS.map((value) => ({ value, label: TIME_FORMAT_LABELS[value] }))} error={fieldErrors.timeFormat} />
              </Section>
              {twoFactorEnabled && <TwoFactor />}
              <Photos editing initials={initials} name={fullName || email} src={picture} photoName={photo?.name} onChoose={choosePhoto} hasPhoto={hasPhoto || Boolean(photo)} />
              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="secondary" onClick={stopEditing} disabled={pending}>
                  Cancel
                </Button>
                <Button type="submit" loading={pending}>
                  {pending ? "Saving" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </Form>
      ) : (
        <div className="grid gap-4">
          <Section title="Basic info">
            <Readout label="Logged in as" value={email} />
            <Readout label="Full name" value={fullName || "Not provided"} />
            <Readout label="Phone" value={shownPhone} />
            <Readout label="Time format" value={TIME_FORMAT_LABELS[timeFormat]} />
          </Section>
          {twoFactorEnabled && <TwoFactor />}
          <Photos initials={initials} name={fullName || email} src={picture} />
        </div>
      )}
    </div>
  );
}

function TwoFactor() {
  return (
    <Section title="Two-factor authentication">
      <p className="m-0 flex min-h-11 items-center gap-2 type-body-sm text-ink sm:col-span-2">
        <Icon name="shield" size={18} />
        Enabled
      </p>
    </Section>
  );
}

function Photos({
  editing = false,
  initials,
  name,
  src,
  photoName,
  hasPhoto = false,
  onChoose,
}: {
  editing?: boolean;
  initials: string;
  name: string;
  src: string | null;
  photoName?: string;
  hasPhoto?: boolean;
  onChoose?: (file: File | undefined) => void;
}) {
  return (
    <Section title="Photos">
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <Photo key={src ?? "initials"} name={name} initials={initials} src={src} />
        {editing && (
          <label className={buttonClasses({ variant: "ghost", size: "sm", className: "cursor-pointer" })}>
            <Icon name="plus" size={18} />
            <span>{hasPhoto ? "Change" : "Add"}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => onChoose?.(event.target.files?.[0])} />
          </label>
        )}
        {photoName && <p className="m-0 type-body-sm text-ink-muted">{photoName}</p>}
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card as="section" padding="none">
      <h2 className="m-0 border-b border-border px-4 py-3 type-label">{title}</h2>
      <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">{children}</div>
    </Card>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="m-0 type-caption text-ink-muted">{label}</p>
      <p className="m-0 type-body-sm text-ink">{value}</p>
    </div>
  );
}

function Photo({ name, initials, src }: { name: string; initials: string; src: string | null }) {
  const [failed, setFailed] = useState(false);
  const show = Boolean(src) && !failed;
  return (
    <span className="grid size-16 place-items-center overflow-hidden rounded-full bg-surface-sunken text-lg font-semibold text-ink">
      {show ? (
        // A small portrait served by our own route. next/image would add client JS for one picture.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src ?? ""} alt="" onError={() => setFailed(true)} className="size-full object-cover" />
      ) : (
        initials || name.slice(0, 1)
      )}
    </span>
  );
}
